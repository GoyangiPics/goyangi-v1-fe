/**
 * The pure half of importing imgur links as upload files.
 *
 * Kept out of useImgurImport so the fiddly parts — what counts as a dead link,
 * what extension a response really has, whether a fetched file belongs in the
 * upload type that is selected — can be unit-tested without a network. Same
 * split imgurLinks.ts already uses for parsing.
 */

/**
 * localStorage key for the /tools → /uploads link handoff.
 *
 * A one-shot stash rather than a query string: a batch of imgur links is far
 * past what belongs in a URL, and the receiving page deletes the key as it
 * reads it. Same mechanism as usePageTitleHandoff.
 */
export const IMGUR_HANDOFF_KEY = 'imgurUploadLinks'

/**
 * Where imgur sends a request for content that no longer exists.
 *
 * This is the trap that makes naive imgur importing quietly wrong: a dead image
 * link does NOT 404. It 302s to this 503-byte grey placeholder and answers 200
 * with `image/png`, so anything checking only `res.ok` — or only the
 * content-type — happily uploads the placeholder as if it were the content.
 * (A dead link requested as `.mp4` 301s to imgur.com's HTML homepage instead,
 * which the media-type check below is what catches.)
 */
const REMOVED_PLACEHOLDER = '/removed.png'

/** True when a response's FINAL url (after redirects) is imgur's tombstone. */
export function isRemovedPlaceholder(finalUrl: string): boolean {
  try {
    return new URL(finalUrl).pathname.toLowerCase().endsWith(REMOVED_PLACEHOLDER)
  } catch {
    return false
  }
}

/** The extension we give a fetched file, by what the server says it is. */
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
}

/** `image/png; charset=binary` → `image/png`. */
export function normalizeMime(header: string | null): string {
  return (header ?? '').split(';')[0]!.trim().toLowerCase()
}

/**
 * Whether a response is media at all.
 *
 * The dead-`.mp4` redirect lands on `text/html`, so this is the second half of
 * dead-link detection as well as a sanity check on anything odd imgur returns.
 */
export function isMediaMime(mime: string): boolean {
  return mime in MIME_EXTENSIONS
}

export function extensionForMime(mime: string): string | null {
  return MIME_EXTENSIONS[mime] ?? null
}

/**
 * A filename for the fetched blob, from the imgur id and the REAL content type.
 *
 * The id rather than anything user-supplied, and the served type rather than the
 * requested extension — a link normalized to `.mp4` that comes back `image/gif`
 * must not be staged as an mp4, because filetype is inferred downstream.
 */
export function imgurFilename(url: string, mime: string): string {
  const ext = extensionForMime(mime) ?? 'bin'
  let id = 'imgur'
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop() ?? ''
    const stem = last.includes('.') ? last.slice(0, last.lastIndexOf('.')) : last
    if (stem) id = stem
  } catch {
    // Keep the fallback id.
  }
  return `${id}.${ext}`
}

/**
 * The `.jpg` retry for a link normalizeImgurUrl had to guess at.
 *
 * An extension-less imgur link becomes `.mp4` (see imgurLinks.ts), which is the
 * right guess for video and wrong for every still — and a still requested as
 * `.mp4` 301s away rather than serving the image. Imgur serves an existing id
 * under any image extension, so one retry rescues those. Returns null when there
 * is nothing to retry.
 */
export function stillFallbackUrl(url: string): string | null {
  if (!/\.mp4$/i.test(url)) return null
  return url.replace(/\.mp4$/i, '.jpg')
}

/**
 * Whether a fetched file belongs in the upload type that is currently selected.
 *
 * `accept` is the same string the dropzone uses, mixing mime types and
 * extensions — so pasting an imgur mp4 while the Pics tab is active is caught
 * here rather than by the backend.
 */
export function isAcceptedByFilter(mime: string, filename: string, accept: string): boolean {
  const ext = filename.includes('.') ? `.${filename.split('.').pop()!.toLowerCase()}` : ''
  return accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .some((token) => {
      if (token.startsWith('.')) return token === ext
      if (token.endsWith('/*')) return mime.startsWith(token.slice(0, -1))
      return token === mime
    })
}
