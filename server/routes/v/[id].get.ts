/**
 * Short media links: `/v/<contentId><suffix>` 302s to the record's rendition on
 * the CDN.
 *
 * The CDN keys are namespaced by group/idol/date (see hooks/r2.go in the
 * backend), which makes a pasted link ~85 characters — long enough to wrap in a
 * Discord message. Discord's unfurler follows redirects and embeds the final
 * response, so a redirect to the file renders like the CDN link, with a third of
 * the text.
 *
 * The suffix is the real file's extension, and it is not decoration: Discord
 * decides how to treat a media link from the extension in the URL, before it
 * has fetched anything. `/v/<id>` with no extension got the generic unfurl,
 * which renders an animated WebP as its first frame. `/v/<id>.webp` gets the
 * direct-media path, which animates. Variants:
 *
 *   /v/<id>.webp | .avif   the preview (animated for gifs, the grid still for
 *                          images)
 *   /v/<id>.mp4            the AV1 original
 *   /v/<id>-sd.mp4         the H.264 720p rendition, falling back to the
 *                          original when the record predates it — same rule as
 *                          the `?sd` embed variant, for the same reason: a link
 *                          to nothing is worse than a link to AV1
 *   /v/<id>-hd.avif        an image's full-size original, which shares its
 *                          extension with the preview and so needs the marker
 *
 * `/v/<id>` with `?hd` / `?sd` / nothing is the first shape this route had;
 * links already pasted keep resolving.
 *
 * A record still encoding has none of these; that 404s uncached so the link
 * starts working the moment the encode lands. Discord caches unfurls per URL, so
 * variants are distinct URLs rather than one URL whose target changes.
 */

interface Renditions {
  preview?: string
  original?: string
  sd?: string
}

// Content ids are minted backend-side as `<yymmdd>-<group>-<idol>-<hash>`; the
// id part is a shape check that keeps a path or query out of the fetch, nothing
// more. The suffix is what picks the rendition.
const SHAPE = /^([a-zA-Z0-9_-]{1,80}?)(?:(-sd|-hd)?\.(mp4|webp|avif))?$/

export default defineEventHandler(async (event) => {
  const m = SHAPE.exec(getRouterParam(event, 'id') ?? '')
  if (!m) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const [, id, marker, ext] = m

  const { baseUrl } = useRuntimeConfig().public
  let r: Renditions
  try {
    r = await $fetch<Renditions>(
      `${baseUrl}api/collections/contents/records/${id}?fields=preview,original,sd`,
    )
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const q = getQuery(event)
  let target: string | undefined
  if (marker === '-sd') target = r.sd || r.original
  else if (marker === '-hd' || ext === 'mp4') target = r.original
  else if (ext) target = r.preview || r.original
  else if ('sd' in q) target = r.sd || r.original
  else if ('hd' in q) target = r.original
  else target = r.preview || r.original

  if (!target) throw createError({ statusCode: 404, statusMessage: 'Not ready' })

  // Renditions are written once, in a single save at the end of the encode, so
  // a resolved link never changes. An hour keeps a shared link from hitting
  // PocketBase for every viewer without making a mistake permanent.
  setHeader(event, 'Cache-Control', 'public, max-age=3600')
  return sendRedirect(event, target, 302)
})
