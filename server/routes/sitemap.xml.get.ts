/**
 * The sitemap index: one entry per chunk of each public collection, plus the
 * static pages. Three `perPage=1` requests for the totals is all it costs; the
 * URLs themselves are in the chunks (see sitemaps/[name].get.ts).
 */
export default defineEventHandler(async (event) => {
  const { baseUrl, siteUrl } = useRuntimeConfig().public
  const site = siteUrl.replace(/\/+$/, '')

  async function total(collection: string, filter: string): Promise<number> {
    const q = new URLSearchParams({ perPage: '1', fields: 'id' })
    if (filter) q.set('filter', filter)
    try {
      const res = await $fetch<{ totalItems: number }>(
        `${baseUrl}api/collections/${collection}/records?${q}`,
      )
      return res.totalItems
    } catch {
      return 0
    }
  }

  const locs = [`${site}/sitemaps/pages.xml`]
  for (const [name, spec] of Object.entries(SITEMAP_COLLECTIONS)) {
    const n = chunkCount(await total(spec.collection, spec.filter))
    for (let i = 1; i <= n; i++) locs.push(`${site}/sitemaps/${name}-${i}.xml`)
  }

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  // Fresh enough for crawlers, and cacheable at the edge for a day: a Cache
  // Rule on /sitemap* is what actually keeps repeat hits off the Worker.
  setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=86400')
  return renderIndex(locs)
})
