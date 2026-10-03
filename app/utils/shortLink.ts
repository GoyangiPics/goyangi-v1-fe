/**
 * Short media links, `/v/<id><suffix>`, resolved by server/routes/v/[id].get.ts.
 *
 * What every "copy link" surface hands out instead of the CDN URL. The CDN URL
 * stays in use for playback and downloads — those never show anyone the string.
 *
 * The suffix carries the real file's extension because Discord classifies a
 * media link by the extension in the URL before fetching it: a bare `/v/<id>`
 * rendered an animated WebP as one frame, `/v/<id>.webp` animates. So the link
 * is built from the record, not just its id — the extension has to be the one
 * the rendition actually has.
 */

export type ShortLinkVariant = 'preview' | 'hd' | 'sd'

/** The three short links a record can offer, keyed like useRowSelection's RowLinks. */
export interface ShortLinks {
  preview?: string
  sd?: string
  hd?: string
}

/** The subset of a content record this helper needs. */
export interface LinkSource {
  id: string
  preview?: string
  original?: string
  sd?: string
}

// The canonical host, for the one place a link could be built without a
// window: `useDetailSeo` hardcodes the same host for the canonical tag.
const FALLBACK_ORIGIN = 'https://goyangi.pics'

/**
 * The current origin, so a dev deploy hands out dev links and a local one hands
 * out localhost — each redirect route can only resolve against its own backend.
 */
function currentOrigin(): string {
  return typeof window === 'undefined' ? FALLBACK_ORIGIN : window.location.origin
}

/** The file extension of a CDN URL, lower-cased, without the dot. */
function extensionOf(url: string): string {
  return /\.([a-z0-9]+)(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase() ?? ''
}

/**
 * The suffix for one rendition, or null when the record lacks it.
 *
 *   preview   `.webp` / `.avif`, whichever the preview object is
 *   hd        `.mp4` for gifs and videos; `-hd.avif` for images, whose original
 *             shares its extension with the preview and needs the marker
 *   sd        `-sd.mp4`
 */
function suffixFor(record: LinkSource, variant: ShortLinkVariant): string | null {
  if (variant === 'preview') {
    const ext = extensionOf(record.preview ?? '')
    return ext ? `.${ext}` : null
  }
  if (variant === 'sd') return record.sd ? '-sd.mp4' : null
  const ext = extensionOf(record.original ?? '')
  if (!ext) return null
  return ext === 'mp4' ? '.mp4' : `-hd.${ext}`
}

/**
 * One short link, or null when the record has no such rendition.
 *
 * Null rather than a link that 404s: the callers feed these into "Copy SD Links
 * (N)" counters, and a rendition the encode never produced should not count.
 */
export function shortLink(
  record: LinkSource,
  variant: ShortLinkVariant = 'preview',
  origin = currentOrigin(),
): string | null {
  const suffix = suffixFor(record, variant)
  if (suffix === null) return null
  return `${origin.replace(/\/+$/, '')}/v/${record.id}${suffix}`
}

/** Short links for whichever renditions the record actually has. */
export function shortLinks(record: LinkSource, origin = currentOrigin()): ShortLinks {
  return {
    preview: shortLink(record, 'preview', origin) ?? undefined,
    hd: shortLink(record, 'hd', origin) ?? undefined,
    sd: shortLink(record, 'sd', origin) ?? undefined,
  }
}
