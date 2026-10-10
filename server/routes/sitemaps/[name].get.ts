/**
 * One sitemap chunk: `/sitemaps/contents-3.xml` is records 4001–6000 of
 * `contents` in id order, as `/single/<id>` URLs with lastmod. Two PocketBase
 * requests per chunk, a fixed amount of work whatever the collection's size —
 * which is the point (see server/utils/sitemap.ts).
 *
 * Sorted by id, which is stable across requests, so a record stays in the same
 * chunk between crawls; `-created` would shift everything by one on every
 * upload.
 */
export default defineEventHandler(async (event) => {
  const parsed = parseChunkName(getRouterParam(event, 'name') ?? '')
  if (!parsed) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const { baseUrl, siteUrl } = useRuntimeConfig().public
  const site = siteUrl.replace(/\/+$/, '')

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=86400')

  if (parsed.name === 'pages') {
    return renderUrlset(SITEMAP_STATIC_PATHS.map((p) => ({ loc: `${site}${p}` })))
  }

  const spec = SITEMAP_COLLECTIONS[parsed.name]
  const urls: SitemapUrl[] = []
  for (const page of pbPagesForChunk(parsed.chunk)) {
    const q = new URLSearchParams({
      page: String(page),
      perPage: String(PB_PAGE_SIZE),
      sort: 'id',
      fields: 'id,updated',
      skipTotal: '1',
    })
    if (spec.filter) q.set('filter', spec.filter)
    // A plain `string` URL: it's PocketBase, not one of our routes, and matching a
    // template literal against Nitro's typed routes is needlessly deep.
    const url: string = `${baseUrl}api/collections/${spec.collection}/records?${q}`
    let res: { items: { id: string; updated?: string }[] }
    try {
      res = await $fetch<typeof res>(url)
    } catch {
      throw createError({ statusCode: 502, statusMessage: 'Upstream unavailable' })
    }
    for (const r of res.items) {
      urls.push({ loc: `${site}/${spec.path}/${r.id}`, lastmod: lastmod(r.updated) })
    }
    if (res.items.length < PB_PAGE_SIZE) break
  }

  // A chunk past the end — the index is cached for a day and things get deleted.
  if (urls.length === 0) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  return renderUrlset(urls)
})
