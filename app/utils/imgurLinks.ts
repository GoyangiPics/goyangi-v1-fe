/**
 * Imgur link extraction + normalization, shared by the tools pages via
 * useImgurTools. Pure so it can be unit-tested — the Go side of the same
 * problem (bot/links.go) has an extensive test file, and this half used to
 * have none while living inline in the composable.
 */

/** Matches any imgur URL embedded in prose, markdown, or angle brackets. */
const IMGUR_URL_RE = /https?:\/\/(?:i\.)?imgur\.com\/[^\s)>\]"']+/gi

// No 'gif': imgur serves every gif as an mp4 at the .mp4 URL, and the upload
// page no longer accepts the legacy container, so a .gif link resolves to the
// video the way .gifv always has.
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp']

/**
 * Tidy an imgur URL.
 *
 * Albums/galleries can't be resolved to a file from the frontend (the album
 * hash and the image hash are unrelated, and the only resolver — the Imgur
 * API — needs a Client-ID), so we just shorten them to their bare album URL:
 *   imgur.com/a/<slug>-<id> → imgur.com/a/<id>
 * Everything else becomes a direct i.imgur.com media link: the .gifv video page
 * extension and extension-less links resolve to .mp4, while image extensions
 * are preserved. Returns null for input we can't make sense of.
 */
export function normalizeImgurUrl(raw: string): string | null {
  // Drop trailing punctuation that clings on from surrounding prose.
  const cleaned = raw.replace(/[.,;]+$/, '')
  let pathname: string
  try {
    pathname = new URL(cleaned).pathname
  } catch {
    return null
  }

  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return null

  let segment = parts[parts.length - 1] ?? ''

  // Split off the extension (if any) before touching the id.
  let ext = ''
  const dot = segment.lastIndexOf('.')
  if (dot !== -1) {
    ext = segment.slice(dot + 1).toLowerCase()
    segment = segment.slice(0, dot)
  }

  // The real id is the bit after the last hyphen — imgur ids never contain
  // hyphens, so this only strips descriptive album slugs.
  if (segment.includes('-')) segment = segment.split('-').pop() ?? segment

  if (!segment) return null

  // Keep albums/galleries as a short imgur.com album URL (can't resolve here).
  const kind = parts[0]?.toLowerCase()
  if (kind === 'a' || kind === 'gallery') return `https://imgur.com/${kind}/${segment}`

  if (ext && IMAGE_EXTS.includes(ext)) return `https://i.imgur.com/${segment}.${ext}`

  // .gifv, .mp4, and extension-less single links → playable .mp4.
  return `https://i.imgur.com/${segment}.mp4`
}

/** Pull every imgur link out of raw text, normalized and de-duplicated. */
export function extractImgurLinks(text: string): string[] {
  const matches = text.match(IMGUR_URL_RE) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const match of matches) {
    const normalized = normalizeImgurUrl(match)
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized)
      out.push(normalized)
    }
  }
  return out
}
