/** The subset of a content record this helper needs. */
interface ThumbSource {
  static?: string
  preview?: string
  original?: string
  filetype?: string
}

const IMAGE_EXT = /\.(avif|webp|png|jpe?g)$/i

/**
 * Cheapest still image for a content item, for the small thumbnail strips on
 * set/collection cards and the upload merge dialog.
 *
 * Returns `''` when nothing on the record can be decoded by an `<img>` — a gif
 * whose animated preview failed and fell back to the mp4 URL, for instance. Let
 * the caller render its own empty state rather than emitting a broken image.
 *
 * ## Why not `useContentSources().previewImageSrc`
 *
 * That resolves the image a *media surface* should show: it honours the user's
 * `contentFormat` setting and prefers the animated preview, because there the
 * point is to stand in for playback. Here the priority is inverted — `static`
 * first, because these are tiny tiles rendered a dozen at a time. Same
 * extension test, opposite order, deliberately.
 *
 * ## Why the fallback chain has three links
 *
 * `static` is the right field and is what this replaced a bare `item.original`
 * with — for a gif, `original` is an AV1 **mp4**, which an `<img>` cannot decode,
 * which is why the merge dialog's tiles were blank. But `static` alone is not
 * enough: the backend generates it best-effort and swallows failures, and
 * stickers never get one at all. For stills and stickers `original` *is* a
 * decodable image, so it closes the gap.
 */
export function contentThumbUrl(item: ThumbSource | null | undefined): string {
  if (!item) return ''

  if (item.static) return item.static
  if (IMAGE_EXT.test(item.preview ?? '')) return item.preview ?? ''
  if (item.filetype === 'image' || item.filetype === 'sticker') return item.original ?? ''

  return ''
}
