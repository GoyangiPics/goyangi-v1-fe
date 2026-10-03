/**
 * Sitemap building blocks — pure, so they can be unit-tested.
 *
 * The site has ~19k content pages and grows daily. A single sitemap that walked
 * every record on each crawler hit ran to ~40 API calls per request, which on
 * Cloudflare Workers meant exceeding the CPU budget and answering 503 — so the
 * site had no working sitemap at all. The shape below is the one large media
 * sites use: an index pointing at chunked sitemaps, each small enough to build
 * from a couple of API calls, and each cacheable at the edge on its own.
 */

/** URLs per chunk. Two PocketBase pages of 1000; well under the 50k/50MB sitemap limits. */
export const SITEMAP_CHUNK_SIZE = 2000

/** PocketBase's hard cap on `perPage`. */
export const PB_PAGE_SIZE = 1000

/** The collections that have public pages, and the page each record maps to. */
export const SITEMAP_COLLECTIONS = {
  contents: { collection: 'contents', path: 'single', filter: '' },
  sets: { collection: 'contents_sets', path: 'set', filter: '' },
  collections: { collection: 'contents_collections', path: 'collection', filter: 'isPublic=true' },
} as const

export type SitemapCollection = keyof typeof SITEMAP_COLLECTIONS

/** Public pages that aren't records. Auth-gated listings are deliberately absent. */
export const SITEMAP_STATIC_PATHS = ['/about', '/privacy', '/terms', '/takedown'] as const

/** How many chunks a collection of `total` records needs. */
export function chunkCount(total: number, size = SITEMAP_CHUNK_SIZE): number {
  return total <= 0 ? 0 : Math.ceil(total / size)
}

/**
 * The PocketBase pages (1-based) that make up chunk `chunk` (1-based).
 * A chunk of 2000 over pages of 1000 is pages 1–2, 3–4, and so on.
 */
export function pbPagesForChunk(
  chunk: number,
  chunkSize = SITEMAP_CHUNK_SIZE,
  pageSize = PB_PAGE_SIZE,
): number[] {
  const perChunk = Math.ceil(chunkSize / pageSize)
  const first = (chunk - 1) * perChunk + 1
  return Array.from({ length: perChunk }, (_, i) => first + i)
}

/** `contents-3.xml` → { name: 'contents', chunk: 3 }; `pages.xml` → { name: 'pages' }. */
export function parseChunkName(
  file: string,
): { name: SitemapCollection; chunk: number } | { name: 'pages' } | null {
  if (file === 'pages.xml') return { name: 'pages' }
  const m = /^(contents|sets|collections)-([1-9]\d{0,3})\.xml$/.exec(file)
  if (!m) return null
  return { name: m[1] as SitemapCollection, chunk: Number(m[2]) }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`)
}

/** PocketBase's `updated` ("2026-09-06 15:21:38.123Z") as a W3C date for lastmod. */
export function lastmod(updated: string | undefined): string | undefined {
  if (!updated) return undefined
  const d = new Date(updated.replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
}

export interface SitemapUrl {
  loc: string
  lastmod?: string
}

export function renderUrlset(urls: readonly SitemapUrl[]): string {
  const body = urls
    .map((u) => {
      const mod = u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''
      return `<url><loc>${escapeXml(u.loc)}</loc>${mod}</url>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`
}

export function renderIndex(locs: readonly string[]): string {
  const body = locs.map((loc) => `<sitemap><loc>${escapeXml(loc)}</loc></sitemap>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`
}
