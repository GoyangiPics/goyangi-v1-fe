import { ref } from 'vue'

/** One imgur link that made it into a staged file. */
export interface ImgurImportItem {
  file: File
  /** The link as pasted-and-normalized — the identity re-imports dedupe on. */
  url: string
  /**
   * The URL that actually answered, which is what belongs on the record as
   * `mirror`. Differs from `url` when the still-image fallback served: a bare
   * link normalizes to `.mp4`, and storing that form for a still would put a
   * link that redirects to imgur's homepage on the record.
   */
  servedUrl: string
}

/** Why a link didn't make it, grouped so the dialog can say what to do. */
export type ImgurSkipReason = 'dead' | 'type' | 'size' | 'network'

export interface ImgurSkip {
  url: string
  reason: ImgurSkipReason
}

export interface ImgurImportOutcome {
  items: ImgurImportItem[]
  skipped: ImgurSkip[]
}

export interface ImgurImportLimits {
  /** How many more files the staging area can take. */
  remaining: number
  maxFileSizeMB: number
  /** The upload type's dropzone filter, so a video can't land on the Pics tab. */
  accept: string
  /**
   * Links already staged from a previous import.
   *
   * Skipped before the fetch, not after: the dropzone's own dedupe can't help
   * here because a re-fetched blob becomes a File with a fresh `lastModified`,
   * so its fileKey differs and it would stage — and then upload — twice. Easy to
   * trigger by pressing "Send to Upload" on /tools a second time.
   */
  staged?: string[]
}

/**
 * Same figure as the other bulk paths. These are third-party fetches, so this is
 * politeness toward imgur as much as it is about our own throughput.
 */
const IMGUR_FETCH_CONCURRENCY = 4

/** Carries the reason out of fetchOne so the caller can group failures. */
class ImgurSkipError extends Error {
  reason: ImgurSkipReason

  constructor(reason: ImgurSkipReason) {
    super(reason)
    this.reason = reason
  }
}

/**
 * Turn pasted imgur links into staged upload files, in the browser.
 *
 * Fetching client-side is what makes this a frontend-only feature: imgur serves
 * `access-control-allow-origin: *` on i.imgur.com, so the blob can be read
 * directly and handed to the existing upload pipeline as a File. The cost is
 * that the bytes travel down to the browser and back up again — fine for
 * recovering a handful of things whose source files are gone, which is what this
 * is for, and the reason it is not the path for bulk archival.
 *
 * What it deliberately does NOT do: albums and galleries. Resolving one needs
 * imgur's OpenGraph tags, and imgur.com's HTML pages send no CORS headers, so
 * the browser cannot read them. normalizeImgurUrl already shortens albums rather
 * than resolving them; they arrive here as non-media and are reported dead. The
 * bot resolves them server-side (bot/links.go) if that path is ever wanted here.
 */
export function useImgurImport() {
  const isImporting = ref(false)
  const importedSoFar = ref(0)
  const importTotal = ref(0)

  /** One link → one File, or an ImgurSkipError saying why not. */
  async function fetchOne(url: string, limits: ImgurImportLimits): Promise<File> {
    let response: Response
    try {
      response = await fetch(url, { redirect: 'follow' })
    } catch {
      // Includes the CORS failure a dead `.mp4` produces: it 301s to imgur.com,
      // whose HTML pages send no CORS headers, so the redirect is what throws.
      throw new ImgurSkipError('network')
    }

    if (!response.ok) throw new ImgurSkipError('dead')
    // The important one — see isRemovedPlaceholder. A dead image link answers
    // 200 with a grey placeholder rather than failing.
    if (isRemovedPlaceholder(response.url)) throw new ImgurSkipError('dead')

    const mime = normalizeMime(response.headers.get('content-type'))
    if (!isMediaMime(mime)) throw new ImgurSkipError('dead')

    const filename = imgurFilename(url, mime)
    if (!isAcceptedByFilter(mime, filename, limits.accept)) throw new ImgurSkipError('type')

    const blob = await response.blob()
    if (blob.size > limits.maxFileSizeMB * 1024 * 1024) throw new ImgurSkipError('size')

    return new File([blob], filename, { type: mime })
  }

  /**
   * Fetch with the one retry that extension-less links need, reporting which
   * URL actually served — that is the one worth keeping as `mirror`.
   *
   * normalizeImgurUrl has to guess, and it guesses `.mp4` — right for video,
   * wrong for every still. A still requested as `.mp4` redirects away instead of
   * serving, so without this every bare link to an image would report dead. A
   * genuinely dead id fails both ways, so the retry costs one wasted request on
   * links that were never going to work.
   */
  async function fetchWithFallback(
    url: string,
    limits: ImgurImportLimits,
  ): Promise<{ file: File; servedUrl: string }> {
    try {
      return { file: await fetchOne(url, limits), servedUrl: url }
    } catch (error) {
      const fallback = stillFallbackUrl(url)
      // Only the "this isn't media" outcomes are worth retrying — a file that
      // was too large or of the wrong type for this tab will be the same again.
      const retryable =
        error instanceof ImgurSkipError && (error.reason === 'dead' || error.reason === 'network')
      if (!fallback || !retryable) throw error
      return { file: await fetchOne(fallback, limits), servedUrl: fallback }
    }
  }

  /**
   * Parse, fetch, and report.
   *
   * Parsing is extractImgurLinks — the same normalizer the tools pages use, so
   * markdown, Discord mentions and prose all work here too. `remaining` caps the
   * batch at whatever room the staging area has left; the overflow is reported
   * rather than silently dropped.
   */
  async function importLinks(
    raw: string,
    limits: ImgurImportLimits,
  ): Promise<ImgurImportOutcome & { parsed: number; overflow: number; duplicates: number }> {
    const links = extractImgurLinks(raw)
    const alreadyStaged = new Set(limits.staged ?? [])
    const fresh = links.filter((link) => !alreadyStaged.has(link))
    const duplicates = links.length - fresh.length
    const accepted = fresh.slice(0, Math.max(0, limits.remaining))
    const overflow = fresh.length - accepted.length

    const outcome: ImgurImportOutcome = { items: [], skipped: [] }
    if (accepted.length === 0) {
      return { ...outcome, parsed: links.length, overflow, duplicates }
    }

    isImporting.value = true
    importedSoFar.value = 0
    importTotal.value = accepted.length

    // Results land in a slot per link rather than a shared push, so the staged
    // files keep the pasted order — completion order is whatever the four
    // workers' fetches happened to race to.
    const slots: Array<ImgurImportItem | null> = accepted.map(() => null)

    // Worker pool over a shared cursor, matching useLikeAll — a slow fetch in
    // one chunk would otherwise idle the rest.
    let cursor = 0
    async function worker() {
      while (cursor < accepted.length) {
        const index = cursor++
        const url = accepted[index]
        if (!url) continue
        try {
          const { file, servedUrl } = await fetchWithFallback(url, limits)
          slots[index] = { file, url, servedUrl }
        } catch (error) {
          outcome.skipped.push({
            url,
            reason: error instanceof ImgurSkipError ? error.reason : 'network',
          })
        }
        importedSoFar.value++
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(IMGUR_FETCH_CONCURRENCY, accepted.length) }, worker),
    )

    outcome.items = slots.filter((item): item is ImgurImportItem => item !== null)
    isImporting.value = false
    return { ...outcome, parsed: links.length, overflow, duplicates }
  }

  return { isImporting, importedSoFar, importTotal, importLinks }
}
