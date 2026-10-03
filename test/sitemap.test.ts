import { describe, expect, it } from 'vitest'
import {
  chunkCount,
  lastmod,
  parseChunkName,
  pbPagesForChunk,
  renderIndex,
  renderUrlset,
} from '../server/utils/sitemap'

describe('chunkCount', () => {
  it('rounds up, and is zero for nothing', () => {
    expect(chunkCount(0)).toBe(0)
    expect(chunkCount(1)).toBe(1)
    expect(chunkCount(2000)).toBe(1)
    expect(chunkCount(2001)).toBe(2)
    expect(chunkCount(18793)).toBe(10)
  })
})

describe('pbPagesForChunk', () => {
  // Two PocketBase pages of 1000 per chunk of 2000.
  it('maps chunks onto consecutive PocketBase pages', () => {
    expect(pbPagesForChunk(1)).toEqual([1, 2])
    expect(pbPagesForChunk(2)).toEqual([3, 4])
    expect(pbPagesForChunk(10)).toEqual([19, 20])
  })
})

describe('parseChunkName', () => {
  it('reads a collection chunk', () => {
    expect(parseChunkName('contents-3.xml')).toEqual({ name: 'contents', chunk: 3 })
    expect(parseChunkName('collections-1.xml')).toEqual({ name: 'collections', chunk: 1 })
  })

  it('reads the static pages file', () => {
    expect(parseChunkName('pages.xml')).toEqual({ name: 'pages' })
  })

  it('rejects anything else', () => {
    expect(parseChunkName('contents-0.xml')).toBeNull()
    expect(parseChunkName('users-1.xml')).toBeNull()
    expect(parseChunkName('contents-1')).toBeNull()
    expect(parseChunkName('../etc')).toBeNull()
  })
})

describe('lastmod', () => {
  it('turns a PocketBase timestamp into a W3C date', () => {
    expect(lastmod('2026-09-06 15:21:38.123Z')).toBe('2026-09-06')
  })

  it('is undefined for missing or unparseable input', () => {
    expect(lastmod(undefined)).toBeUndefined()
    expect(lastmod('nope')).toBeUndefined()
  })
})

describe('rendering', () => {
  it('renders a urlset with escaped locs and optional lastmod', () => {
    const xml = renderUrlset([
      { loc: 'https://goyangi.pics/single/a&b', lastmod: '2026-09-06' },
      { loc: 'https://goyangi.pics/about' },
    ])
    expect(xml).toContain(
      '<loc>https://goyangi.pics/single/a&#38;b</loc><lastmod>2026-09-06</lastmod>',
    )
    expect(xml).toContain('<url><loc>https://goyangi.pics/about</loc></url>')
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?><urlset')).toBe(true)
  })

  it('renders an index', () => {
    const xml = renderIndex(['https://goyangi.pics/sitemaps/pages.xml'])
    expect(xml).toContain('<sitemap><loc>https://goyangi.pics/sitemaps/pages.xml</loc></sitemap>')
    expect(xml).toContain('<sitemapindex')
  })
})
