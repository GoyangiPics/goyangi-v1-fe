import type { Group, Idol } from '~/types/appTypes'
import { describe, expect, it } from 'vitest'
import { inferGroups } from '~/utils/inferGroups'
import { toSlug } from '~/utils/toSlug'

/**
 * Shared with the backend: hooks/slugify_test.go carries this exact table.
 * toSlug must match hooks.Slugify character for character — the FE only ever
 * *predicts* a slug the server then computes for real (QuickLabelModal's
 * duplicate check), and a prediction that disagrees tells the user a label is
 * new when it isn't. Change a vector only in both files at once.
 */
const SLUG_VECTORS: Array<[input: string, slug: string]> = [
  ['IVE', 'ive'],
  ['Jang Wonyoung', 'jang-wonyoung'],
  ['Kwon Eunbi [IZ*ONE]', 'kwon-eunbi-izone'],
  ['Cute!', 'cute'],
  ['4:3', '43'],
  // Underscores are stripped, not kept — label "mirror_selca" stores slug
  // "mirrorselca". This vector used to assert the opposite, which was the
  // FE/BE divergence codified as a test.
  ['mirror_selca', 'mirrorselca'],
  // Only literal spaces map to hyphens, one hyphen each — runs don't collapse.
  ['a   b', 'a---b'],
  ['  spaced  out  ', 'spaced--out'],
  // Other whitespace is stripped by the charset filter, not hyphenated.
  ['a\tb', 'ab'],
  ['already-slugged', 'already-slugged'],
  ['--trim--', 'trim'],
  ['!!!', ''],
  ['', ''],
  ['안유진', ''],
]

describe('toSlug', () => {
  it.each(SLUG_VECTORS)('toSlug(%j) → %j', (input, slug) => {
    expect(toSlug(input)).toBe(slug)
  })
})

const idol = (id: string, group: string) => ({ id, name: id, group }) as unknown as Idol

describe('inferGroups', () => {
  const groups = [
    { id: 'g1', name: 'IVE' },
    { id: 'g2', name: 'TWICE' },
  ] as Group[]

  it('maps idols to their groups', () => {
    expect(inferGroups([idol('i1', 'g1')], groups)).toEqual([groups[0]])
  })

  it('de-duplicates when several idols share a group', () => {
    const result = inferGroups([idol('i1', 'g1'), idol('i2', 'g1')], groups)
    expect(result).toEqual([groups[0]])
  })

  it('returns every distinct group for a mixed selection', () => {
    const result = inferGroups([idol('i1', 'g1'), idol('i2', 'g2')], groups)
    expect(result).toHaveLength(2)
    expect(result.map((g) => g.id)).toEqual(['g1', 'g2'])
  })

  it('drops idols whose group is unknown or missing rather than emitting undefined', () => {
    // The reason for the type guard: these feed a required relation field, and a
    // hole in the array would fail validation server-side.
    const result = inferGroups([idol('i1', 'nope'), idol('i2', ''), idol('i3', 'g1')], groups)
    expect(result).toEqual([groups[0]])
  })

  it('returns empty for no idols', () => {
    expect(inferGroups([], groups)).toEqual([])
  })
})
