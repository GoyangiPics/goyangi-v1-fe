import type { Filters } from '~/types/typesFilters'
import { describe, expect, it } from 'vitest'
import { MostLikedModes } from '~/types/typesFilters'
import { buildPbFilter, combinePbFilters, pbQuote } from '~/utils/filtersFilter'

/** A filter object with everything empty, to be spread over per-case. */
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

describe('pbQuote', () => {
  it('wraps a plain value', () => {
    expect(pbQuote('hi')).toBe('"hi"')
  })

  it('escapes double quotes', () => {
    expect(pbQuote('say "hi"')).toBe('"say \\"hi\\""')
  })

  it('escapes backslashes before quotes, so the escape is not itself escaped away', () => {
    expect(pbQuote('a\\b')).toBe('"a\\\\b"')
    expect(pbQuote('a\\"b')).toBe('"a\\\\\\"b"')
  })
})

describe('buildPbFilter', () => {
  it('emits nothing when no filter is set', () => {
    expect(buildPbFilter(emptyFilters()).filter).toBe('')
  })

  it('quotes the search term', () => {
    // Regression: searchValue was interpolated raw, so one " produced a
    // malformed filter, PocketBase answered 400, and the page looked frozen.
    const { filter } = buildPbFilter(emptyFilters(), { searchValue: 'say "hi"' })
    expect(filter).toBe('title~"say \\"hi\\""')
  })

  describe('clause modes', () => {
    it('matches relations by id, OR-joined', () => {
      const filters = { ...emptyFilters(), idol: [{ id: 'i1' }, { id: 'i2' }] } as any
      expect(buildPbFilter(filters).filter).toBe('(idol.id?="i1"||idol.id?="i2")')
    })

    it('matches option fields by value', () => {
      const filters = { ...emptyFilters(), filetype: [{ value: 'image', option: 'Pics' }] } as any
      expect(buildPbFilter(filters).filter).toBe('(filetype="image")')
    })

    it('filters gifs as gifs, and unions gifs with videos', () => {
      const gifs = { ...emptyFilters(), filetype: [{ value: 'gif', option: 'Gifs' }] } as any
      expect(buildPbFilter(gifs).filter).toBe('(filetype="gif")')

      const both = {
        ...emptyFilters(),
        filetype: [
          { value: 'gif', option: 'Gifs' },
          { value: 'video', option: 'Videos' },
        ],
      } as any
      const clause = buildPbFilter(both).filter
      expect(clause).toContain('filetype="gif"')
      expect(clause).toContain('filetype="video"')
      expect(clause).not.toContain('image')
    })

    it('matches labels by slug, not id', () => {
      // Labels arrive from ?label= as bare slugs, so the clause has to work
      // without an id being known yet.
      const filters = { ...emptyFilters(), label: [{ name: 'Hat', slug: 'hat' }] } as any
      expect(buildPbFilter(filters).filter).toBe('(labels.slug?="hat")')
    })

    it('skips items missing the field its mode needs', () => {
      const filters = { ...emptyFilters(), idol: [{ id: 'i1' }, {}], label: [{ name: 'x' }] } as any
      expect(buildPbFilter(filters).filter).toBe('(idol.id?="i1")')
    })
  })

  describe('remapForSets', () => {
    const filters = () =>
      ({
        ...emptyFilters(),
        idol: [{ id: 'i1' }],
        group: [{ id: 'g1' }],
        uploader: [{ id: 'u1' }],
        tag: [{ id: 't1' }],
        filetype: [{ value: 'image', option: 'Pics' }],
        origin: [{ value: 'direct', option: 'Direct' }],
        label: [{ name: 'Hat', slug: 'hat' }],
      }) as any

    it('resolves fields the set does not have against its children', () => {
      const { filter } = buildPbFilter(filters(), { remapForSets: true })
      expect(filter).toContain('contents_via_set.tag.id?="t1"')
      expect(filter).toContain('contents_via_set.filetype="image"')
      expect(filter).toContain('contents_via_set.labels.slug?="hat"')
    })

    it('resolves fields the set carries itself ON the set', () => {
      // The load-bearing case for origin: a Discord-ingested set does not
      // contain direct-upload children, so asking the children would answer a
      // different question than the filter poses.
      const { filter } = buildPbFilter(filters(), { remapForSets: true })
      expect(filter).toContain('origin="direct"')
      expect(filter).not.toContain('contents_via_set.origin')
      expect(filter).not.toContain('contents_via_set.idol')
      expect(filter).not.toContain('contents_via_set.group')
      expect(filter).not.toContain('contents_via_set.uploader')
    })

    it('leaves paths alone when remapping is off', () => {
      const { filter } = buildPbFilter(filters())
      expect(filter).not.toContain('contents_via_set')
    })
  })

  it('survives a persisted session that predates a field', () => {
    // `filters` is persisted to localStorage, so a returning user's stored
    // object has no origin/label key until the store's afterHydrate merge runs.
    // Reading .length off undefined used to throw on first render.
    const legacy = {
      idol: [{ id: 'i1' }],
      group: [],
      uploader: [],
      filetype: [],
      tag: [],
      date: [],
      dateMode: null,
      sort: null,
    } as any
    expect(() => buildPbFilter(legacy)).not.toThrow()
    expect(buildPbFilter(legacy).filter).toBe('(idol.id?="i1")')
  })

  // A collection has none of the content fields itself; a clause against `idol`
  // on contents_collections was a 400 and an empty page.
  it('resolves every content field through the collection back-relation', () => {
    const filters = {
      ...emptyFilters(),
      idol: [{ id: 'i1' }],
      filetype: [{ value: 'gif', option: 'Gifs' }],
      label: [{ slug: 'cute', name: 'Cute' }],
    } as any
    const { filter } = buildPbFilter(filters, { remapForCollections: true })
    expect(filter).toBe(
      '(contents_via_collections.idol.id?="i1")&&' +
        '(contents_via_collections.filetype="gif")&&' +
        '(contents_via_collections.labels.slug?="cute")',
    )
  })

  it('prefixes every path when filtering through a relation', () => {
    const filters = { ...emptyFilters(), idol: [{ id: 'i1' }] } as any
    const { filter } = buildPbFilter(filters, { useContentPrefix: true })
    expect(filter).toBe('(content.idol.id?="i1")')
  })

  describe('date window', () => {
    it('emits a quoted two-ended range', () => {
      const filters = {
        ...emptyFilters(),
        date: [new Date('2026-05-01T00:00:00'), new Date('2026-05-31T00:00:00')],
      } as any
      const { filter } = buildPbFilter(filters)
      expect(filter).toMatch(/^created>="2026-05-01 00:00:00"&&created<="2026-05-31 23:59:59"$/)
    })

    it('ignores a half-open range', () => {
      const filters = { ...emptyFilters(), date: [new Date('2026-05-01')] } as any
      expect(buildPbFilter(filters).filter).toBe('')
    })
  })

  describe('sort', () => {
    it('defaults to newest first', () => {
      expect(buildPbFilter(emptyFilters()).sort).toBe('-created')
    })

    it('sorts oldest first on request, on every listing', () => {
      const filters = { ...emptyFilters(), sort: { value: 'oldest', option: 'Oldest' } } as any
      expect(buildPbFilter(filters).sort).toBe('created')
      expect(buildPbFilter(filters, { remapForSets: true }).sort).toBe('created')
      expect(buildPbFilter(filters, { canRankByLikes: true }).sort).toBe('created')
    })

    describe('by actual date', () => {
      const actual = { value: 'actual', option: 'Actual' }
      const oldest = { value: 'oldest', option: 'Oldest' }

      it('sorts by the content date, either way round', () => {
        const filters = { ...emptyFilters(), dateMode: actual } as any
        expect(buildPbFilter(filters).sort).toBe('-date')
        expect(buildPbFilter({ ...filters, sort: oldest }).sort).toBe('date')
        // Sets carry a date of their own.
        expect(buildPbFilter(filters, { remapForSets: true }).sort).toBe('-date')
        // The likes list reaches the content through its relation.
        expect(buildPbFilter(filters, { useContentPrefix: true }).sort).toBe('-content.date')
      })

      it('filters the range on the content date too', () => {
        const filters = {
          ...emptyFilters(),
          dateMode: actual,
          date: [new Date(2026, 0, 1), new Date(2026, 0, 31)],
        } as any
        const { filter } = buildPbFilter(filters)
        expect(filter).toMatch(/^date>=".+"&&date<=".+"$/)
      })

      // A collection has no date, and its contents' dates are many.
      it('leaves collections on created', () => {
        const filters = { ...emptyFilters(), dateMode: actual, sort: oldest } as any
        expect(buildPbFilter(filters, { remapForCollections: true }).sort).toBe('created')
      })

      // Top Posts is a window of recent uploads whatever the toggle says.
      it('keeps the Top Posts window on created', () => {
        const filters = { ...emptyFilters(), dateMode: actual } as any
        const { filter } = buildPbFilter(filters, { mostLikedMode: MostLikedModes.AllTime })
        expect(filter).toMatch(/^created>=/)
      })

      it('still ranks by likes when asked', () => {
        const filters = {
          ...emptyFilters(),
          dateMode: actual,
          sort: { value: 'liked', option: 'Most liked' },
        } as any
        expect(buildPbFilter(filters, { canRankByLikes: true }).sort).toBe('-likes:length')
      })
    })

    it('sorts by like count when the collection can take it', () => {
      const filters = { ...emptyFilters(), sort: { value: 'liked', option: 'Most liked' } } as any
      expect(buildPbFilter(filters, { canRankByLikes: true }).sort).toBe('-likes:length')
    })

    it('ranks by likes for the mostLiked preset too', () => {
      // mostLikedMode forces the ranking independently of filters.sort.
      expect(
        buildPbFilter(emptyFilters(), {
          mostLikedMode: MostLikedModes.AllTime,
          canRankByLikes: true,
        }).sort,
      ).toBe('-likes:length')
    })

    // The lockout this guards: `likes` is a field on `contents` alone, and
    // PocketBase 400s a sort on a column that isn't there — so asking
    // contents_sets or contents_collections for it broke the whole page. Since
    // `filters` is persisted the rejected sort came back on every reload, and
    // the filter dialog's Reset could not clear it either.
    it('refuses the ranking unless the collection declares it can take it', () => {
      const filters = { ...emptyFilters(), sort: { value: 'liked', option: 'Most liked' } } as any
      // Fail-safe default: forgetting the flag costs recency order, not the page.
      expect(buildPbFilter(filters).sort).toBe('-created')
      expect(buildPbFilter(filters, { canRankByLikes: false }).sort).toBe('-created')
      // Independent of the set remapping — contents_collections needs the same
      // guard without being a set listing at all.
      expect(buildPbFilter(filters, { remapForSets: true }).sort).toBe('-created')
      // And via the preset, the second route to the same dead end.
      expect(buildPbFilter(emptyFilters(), { mostLikedMode: MostLikedModes.AllTime }).sort).toBe(
        '-created',
      )
    })
  })

  it('joins every clause with &&', () => {
    const filters = {
      ...emptyFilters(),
      idol: [{ id: 'i1' }],
      origin: [{ value: 'direct', option: 'Direct' }],
    } as any
    const { filter } = buildPbFilter(filters, { searchValue: 'fancam' })
    expect(filter).toBe('title~"fancam"&&(idol.id?="i1")&&(origin="direct")')
  })
})

describe('combinePbFilters', () => {
  it('drops empty parts', () => {
    expect(combinePbFilters('a', '', null, undefined, 'b')).toBe('a&&b')
  })

  it('returns an empty string when everything is empty', () => {
    expect(combinePbFilters(null, undefined, '')).toBe('')
  })
})
