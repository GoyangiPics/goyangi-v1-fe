import { describe, expect, it } from 'vite-plus/test'
import { pickPlayable } from '~/utils/playbackCap'

/** Cards stacked top to bottom, 100px tall, starting at `top`. */
function column(ids: string[], top = 0) {
  return ids.map((id, i) => ({ item: id, top: top + i * 100, bottom: top + i * 100 + 100 }))
}

describe('pickPlayable', () => {
  it('lets everything play when at or under the cap', () => {
    expect(pickPlayable(column(['a', 'b', 'c']), 1000, 3, new Set())).toEqual(
      new Set(['a', 'b', 'c']),
    )
  })

  it('keeps the items nearest the viewport centre', () => {
    // Centre is 500; cards e (400-500) and f (500-600) touch it.
    const picked = pickPlayable(column('abcdefghij'.split('')), 1000, 4, new Set())
    expect(picked).toEqual(new Set(['d', 'e', 'f', 'g']))
  })

  it('holds a playing item just past the cut instead of swapping it for a newcomer', () => {
    const items = column('abcdefghij'.split(''))
    // Without hysteresis: d e f g. 'c' ranks 5th/6th (tied with h) — within slack.
    const picked = pickPlayable(items, 1000, 4, new Set(['c', 'd', 'e', 'f']))
    expect(picked.size).toBe(4)
    expect(picked.has('c')).toBe(true)
    expect(picked.has('g')).toBe(false)
    for (const keep of ['d', 'e', 'f']) expect(picked.has(keep)).toBe(true)
  })

  it('does not hold an item that has fallen well outside the slack', () => {
    const items = column('abcdefghij'.split(''))
    const picked = pickPlayable(items, 1000, 4, new Set(['a']))
    expect(picked.has('a')).toBe(false)
    expect(picked.size).toBe(4)
  })

  it('never exceeds the cap', () => {
    const items = column('abcdefghij'.split(''))
    const picked = pickPlayable(items, 1000, 4, new Set('abcdefghij'.split('')))
    expect(picked.size).toBe(4)
  })
})

describe('pickPlayable across a carousel swap', () => {
  // A set card stepping to its next item unmounts one <video> and mounts
  // another in the same place. Between the two, a rerank runs with the slot
  // freed, and the next card down takes it. When the new element then reports
  // visible it is a "newcomer" at the same rank its predecessor held — and the
  // card that just took the slot sits one past the cut, holding it.
  it('does not let a card that just took a freed slot evict the swapped-in item', () => {
    const items = column('abcdefghij'.split(''))
    const centre = items.filter((i) => 'defg'.includes(i.item as string))
    const before = pickPlayable(items, 1000, 4, new Set())
    expect(before).toEqual(new Set(centre.map((i) => i.item)))

    // 'e' unmounts; rerank without it, with 'e' already out of `previous`.
    const previous = new Set(before)
    previous.delete('e')
    const interim = pickPlayable(
      items.filter((i) => i.item !== 'e'),
      1000,
      4,
      previous,
    )
    expect(interim.has('c')).toBe(true)

    // The replacement, at e's exact position, reports visible.
    const swapped = items.map((i) => (i.item === 'e' ? { ...i, item: 'E' } : i))
    const after = pickPlayable(swapped, 1000, 4, interim)
    expect(after.has('E')).toBe(true)
  })

  it('still cannot evict a newcomer ranked well inside the cut', () => {
    const items = column('abcdefghij'.split(''))
    // f (rank 1 or 2) is new; c and h just past the cut were both playing.
    const picked = pickPlayable(items, 1000, 4, new Set(['c', 'd', 'g', 'h']))
    expect(picked.has('f')).toBe(true)
    expect(picked.has('e')).toBe(true)
  })
})
