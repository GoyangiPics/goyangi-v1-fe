import { describe, expect, it } from 'vite-plus/test'
import { carryQuery, hasFilterParams, pageFilterParams, queryKey } from '~/utils/filterSupport'

describe('carryQuery', () => {
  const active = 'idol=Winter~aespa&filetype=gif&page=3'

  it('carries the filters to a page that consumes them', () => {
    expect(carryQuery(active, '/collections')).toEqual({
      idol: 'Winter~aespa',
      filetype: 'gif',
    })
  })

  // Page 4 of one listing is meaningless on another.
  it('never carries the page', () => {
    expect(carryQuery(active, '/')).not.toHaveProperty('page')
  })

  // Parameters nothing applies would sit in the URL looking like they matter.
  it('carries nothing to a page with no filterable listing', () => {
    expect(carryQuery(active, '/uploaders')).toEqual({})
    expect(carryQuery(active, '/stickers')).toEqual({})
  })

  it('is empty when nothing is active', () => {
    expect(carryQuery('', '/')).toEqual({})
  })
})

describe('pageFilterParams', () => {
  it('knows the listing pages and nothing else', () => {
    expect(pageFilterParams('/').length).toBeGreaterThan(0)
    expect(pageFilterParams('/me/likes').length).toBeGreaterThan(0)
    expect(pageFilterParams('/about')).toEqual([])
  })
})

describe('hasFilterParams', () => {
  it('sees a saved-filter id and the Top Posts window as filters', () => {
    expect(hasFilterParams({ filter: 'abc' })).toBe(true)
    expect(hasFilterParams({ top: '1month' })).toBe(true)
  })

  it('ignores page and empty values', () => {
    expect(hasFilterParams({ page: '2' })).toBe(false)
    expect(hasFilterParams({ idol: '' })).toBe(false)
    expect(hasFilterParams({})).toBe(false)
  })
})

describe('queryKey', () => {
  it('is order-independent', () => {
    expect(queryKey({ b: '2', a: '1' })).toBe(queryKey({ a: '1', b: '2' }))
  })

  it('tells different queries apart, including page', () => {
    expect(queryKey({ idol: 'x' })).not.toBe(queryKey({ idol: 'x', page: '2' }))
    expect(queryKey({})).toBe('')
  })

  it('keeps repeated keys', () => {
    expect(queryKey({ tag: ['a', 'b'] })).toBe('tag=a&tag=b')
  })
})
