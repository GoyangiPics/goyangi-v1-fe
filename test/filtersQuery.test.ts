import type { Group, Idol } from '~/types/appTypes'
import type { Filters } from '~/types/typesFilters'
import { MostLikedModes } from '~/types/typesFilters'
import { describe, expect, it } from 'vite-plus/test'
import { serializeFiltersToQuery } from '~/utils/filtersQuery'

function emptyFilters(): Filters {
  return {
    idol: [],
    group: [],
    uploader: [],
    filetype: [],
    tag: [],
    origin: [],
    label: [],
    date: [],
    dateMode: null,
    sort: null,
  }
}

/** The signature's fixed tail: the idol/group directories and the default sort. */
const NO_DIRECTORY: [Idol[], Group[], string | undefined] = [[], [], 'recent']

describe('serializeFiltersToQuery', () => {
  it('emits nothing when nothing is applied', () => {
    expect(serializeFiltersToQuery(emptyFilters(), ...NO_DIRECTORY)).toBe('')
  })

  // The URL is the whole filter state now, so the Top Posts window has to be in
  // it or a reload would drop it.
  it('carries the Top Posts window as top=', () => {
    const query = serializeFiltersToQuery(
      emptyFilters(),
      ...NO_DIRECTORY,
      '',
      MostLikedModes.OneMonth,
    )
    expect(query).toBe('top=1month')
  })

  describe('the search term', () => {
    // Why this belongs in the URL at all: the logo's "start over" refetches by
    // navigating to a URL with no query, and index.vue only refetches on a query
    // TRANSITION. While the search term was absent here, a search-only view
    // already had an empty query — so the logo resolved to the current route,
    // nothing navigated, and the results stayed filtered after the box cleared.
    it('is serialized so a search-only view has a non-empty query', () => {
      expect(serializeFiltersToQuery(emptyFilters(), ...NO_DIRECTORY, 'fancam')).toBe(
        'search=fancam',
      )
    })

    it('is omitted when absent, empty or whitespace', () => {
      for (const value of [undefined, null, '', '   ']) {
        expect(serializeFiltersToQuery(emptyFilters(), ...NO_DIRECTORY, value)).toBe('')
      }
    })

    it('is trimmed and percent-encoded', () => {
      expect(serializeFiltersToQuery(emptyFilters(), ...NO_DIRECTORY, '  hair down  ')).toBe(
        'search=hair%20down',
      )
      expect(serializeFiltersToQuery(emptyFilters(), ...NO_DIRECTORY, 'a&b=c')).toBe(
        'search=a%26b%3Dc',
      )
    })

    it('composes with the other dimensions', () => {
      const filters = {
        ...emptyFilters(),
        tag: [{ name: 'fancam' }],
        origin: [{ value: 'direct', option: 'Direct' }],
      } as any
      expect(serializeFiltersToQuery(filters, ...NO_DIRECTORY, 'yujin')).toBe(
        'search=yujin&tag=fancam&origin=direct',
      )
    })
  })

  it('omits the sort when it is the default, and emits it otherwise', () => {
    const recent = { ...emptyFilters(), sort: { value: 'recent', option: 'Recent' } } as any
    const liked = { ...emptyFilters(), sort: { value: 'liked', option: 'Most Liked' } } as any
    expect(serializeFiltersToQuery(recent, ...NO_DIRECTORY)).toBe('')
    expect(serializeFiltersToQuery(liked, ...NO_DIRECTORY)).toBe('sort=liked')
  })

  it('carries the Actual date basis, and leaves the default out', () => {
    const uploaded = {
      ...emptyFilters(),
      dateMode: { value: 'created', option: 'Uploaded' },
    } as any
    const actual = {
      ...emptyFilters(),
      sort: { value: 'oldest', option: 'Oldest' },
      dateMode: { value: 'actual', option: 'Actual' },
    } as any
    expect(serializeFiltersToQuery(uploaded, ...NO_DIRECTORY)).toBe('')
    expect(serializeFiltersToQuery(actual, ...NO_DIRECTORY)).toBe('sort=oldest&datemode=actual')
  })
})
