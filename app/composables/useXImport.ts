import type { XMediaItem, XPost } from '~/utils/xMedia'
import { ref } from 'vue'
import { isAcceptedByFilter, normalizeMime } from '~/utils/imgurFetch'
import { extractXPostLinks } from '~/utils/xLinks'
import { readXPost, xFilename, xItemKey } from '~/utils/xMedia'

/** One file of an X post that made it into a staged file. */
export interface XImportItem {
  file: File
  /** `xItemKey` — what a second import of the same post dedupes on. */
  key: string
  /** The canonical post link: the file's `source`. */
  postUrl: string
  postId: string
  /** When the post went up: the file's content date. */
  postedAt: Date | null
}

/**
 * Why a post or one of its files didn't make it, grouped so the dialog can say
 * what to do. `dead`, `private` and `noMedia` are per post; the rest per file.
 */
export type XSkipReason = 'dead' | 'private' | 'noMedia' | 'type' | 'size' | 'network'

export interface XSkip {
  url: string
  reason: XSkipReason
}

export interface XImportLimits {
  /** How many more files the staging area can take. */
  remaining: number
  maxFileSizeMB: number
  /** The upload type's dropzone filter: a Pics tab won't take a post's video. */
  accept: string
  /** `xItemKey`s already staged, so pressing import twice doesn't stage twice. */
  staged?: string[]
}

export interface XImportOutcome {
  items: XImportItem[]
  skipped: XSkip[]
  /** Posts found in the text. */
  parsed: number
  /** Files left out for lack of room in the staging area. */
  overflow: number
  /** Files already staged by an earlier import. */
  duplicates: number
}

const API = 'https://api.fxtwitter.com/status/'

/** Posts read at once. Third-party fetches, so politeness as much as speed — the Imgur import's figure. */
const X_FETCH_CONCURRENCY = 4

class XSkipError extends Error {
  reason: XSkipReason

  constructor(reason: XSkipReason) {
    super(reason)
    this.reason = reason
  }
}

/**
 * Turn pasted X post links into staged upload files, in the browser — the
 * Imgur import's design, for X: the FxTwitter API lists a post's media (see
 * utils/xMedia), both twimg hosts allow goyangi.pics as a CORS origin, and the
 * files go into the normal upload flow as Files.
 *
 * FxTwitter is a free third-party service. When it is down or refuses, the
 * post is reported as not loaded and the rest of the batch carries on.
 */
export function useXImport() {
  const isImporting = ref(false)
  const importedSoFar = ref(0)
  const importTotal = ref(0)

  async function fetchPost(id: string): Promise<XPost> {
    let response: Response
    try {
      response = await fetch(API + id)
    } catch {
      throw new XSkipError('network')
    }
    // 404 and 401 arrive as JSON saying so; a 5xx is FxTwitter itself failing.
    if (response.status >= 500) throw new XSkipError('network')
    let body: unknown = null
    if (normalizeMime(response.headers.get('content-type')) === 'application/json') {
      body = await response.json().catch(() => null)
    }
    const post = readXPost(body)
    if (typeof post === 'string') throw new XSkipError(post)
    return post
  }

  /**
   * One item, trying its renditions best first.
   *
   * The size is known from `content-length` before the body is read, so an
   * oversized rendition is abandoned rather than downloaded, and the next one
   * down is tried. A photo has one candidate; for it, "too big" is final.
   */
  async function fetchMedia(item: XMediaItem, limits: XImportLimits): Promise<Blob> {
    const max = limits.maxFileSizeMB * 1024 * 1024
    let lastReason: XSkipReason = 'network'
    for (const url of item.candidates) {
      const controller = new AbortController()
      let response: Response
      try {
        response = await fetch(url, { signal: controller.signal })
      } catch {
        lastReason = 'network'
        continue
      }
      if (!response.ok) {
        lastReason = response.status === 404 ? 'dead' : 'network'
        continue
      }
      const length = Number(response.headers.get('content-length'))
      if (length > max) {
        controller.abort()
        lastReason = 'size'
        continue
      }
      const blob = await response.blob()
      if (blob.size > max) {
        lastReason = 'size'
        continue
      }
      return blob
    }
    throw new XSkipError(lastReason)
  }

  /** Parse, fetch, and report. */
  async function importLinks(raw: string, limits: XImportLimits): Promise<XImportOutcome> {
    const posts = extractXPostLinks(raw)
    const outcome: XImportOutcome = {
      items: [],
      skipped: [],
      parsed: posts.length,
      overflow: 0,
      duplicates: 0,
    }
    if (!posts.length) return outcome

    isImporting.value = true
    importedSoFar.value = 0
    importTotal.value = posts.length

    const alreadyStaged = new Set(limits.staged ?? [])
    let room = Math.max(0, limits.remaining)
    // A slot per post, so files stage in pasted order whatever order the
    // workers finish in.
    const slots: XImportItem[][] = posts.map(() => [])

    let cursor = 0
    async function worker() {
      while (cursor < posts.length) {
        const index = cursor++
        const link = posts[index]!
        try {
          const post = await fetchPost(link.id)
          for (const [n, item] of post.media.entries()) {
            const key = xItemKey(post.id, n)
            if (alreadyStaged.has(key)) {
              outcome.duplicates++
              continue
            }
            const filename = xFilename(post.id, n, item.mime)
            // Decided before downloading: a type the tab can't take costs nothing.
            if (!isAcceptedByFilter(item.mime, filename, limits.accept)) {
              outcome.skipped.push({ url: post.url, reason: 'type' })
              continue
            }
            // Room is claimed before the download, since four workers share it.
            if (room <= 0) {
              outcome.overflow++
              continue
            }
            room--
            try {
              const blob = await fetchMedia(item, limits)
              slots[index]!.push({
                file: new File([blob], filename, { type: item.mime }),
                key,
                postUrl: post.url,
                postId: post.id,
                postedAt: post.postedAt,
              })
            } catch (error) {
              room++
              outcome.skipped.push({
                url: post.url,
                reason: error instanceof XSkipError ? error.reason : 'network',
              })
            }
          }
        } catch (error) {
          outcome.skipped.push({
            url: link.url,
            reason: error instanceof XSkipError ? error.reason : 'network',
          })
        }
        importedSoFar.value++
      }
    }

    try {
      await Promise.all(Array.from({ length: Math.min(X_FETCH_CONCURRENCY, posts.length) }, worker))
    } finally {
      isImporting.value = false
    }
    outcome.items = slots.flat()
    return outcome
  }

  return { isImporting, importedSoFar, importTotal, importLinks }
}
