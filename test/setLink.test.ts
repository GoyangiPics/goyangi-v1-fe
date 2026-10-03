import { describe, expect, it } from 'vitest'
import { setContents, setHref, soleSetContentId } from '~/utils/setLink'

const withContents = (id: string, contentIds: string[]) => ({
  id,
  expand: { contents_via_set: contentIds.map((cid) => ({ id: cid })) },
})

describe('soleSetContentId', () => {
  it('returns the single content id', () => {
    expect(soleSetContentId(withContents('s1', ['c1']))).toBe('c1')
  })

  it('returns null for a multi-item set', () => {
    expect(soleSetContentId(withContents('s1', ['c1', 'c2']))).toBeNull()
  })

  it('returns null when the set is empty or unexpanded', () => {
    expect(soleSetContentId(withContents('s1', []))).toBeNull()
    expect(soleSetContentId({ id: 's1' })).toBeNull()
    expect(soleSetContentId(null)).toBeNull()
  })
})

describe('setHref', () => {
  it('sends a one-item set straight to the item', () => {
    expect(setHref(withContents('s1', ['c1']))).toBe('/single/c1')
  })

  it('sends a real set to its own page', () => {
    expect(setHref(withContents('s1', ['c1', 'c2']))).toBe('/set/s1')
  })

  // An unexpanded set is indistinguishable from an empty one here, and guessing
  // /single/ would be a broken link — the set page is the safe answer.
  it('sends an empty or unexpanded set to its own page', () => {
    expect(setHref(withContents('s1', []))).toBe('/set/s1')
    expect(setHref({ id: 's1' })).toBe('/set/s1')
  })
})

describe('setContents', () => {
  it('is an empty list when nothing is expanded', () => {
    expect(setContents({ id: 's1' })).toEqual([])
  })
})
