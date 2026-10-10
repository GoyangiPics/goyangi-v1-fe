import { describe, expect, it } from 'vite-plus/test'
import { resolveMediaBox, tallestAspectRatio } from '~/utils/mediaBox'

describe('resolveMediaBox', () => {
  it('reserves the item’s own shape when dimensions are stored', () => {
    // The point: the browser can size the card before a byte of media arrives,
    // so the masonry grid stops reflowing on first paint.
    expect(resolveMediaBox('Disabled', 1920, 1080)).toEqual({
      aspectRatio: '1920 / 1080',
      isLetterboxed: false,
    })
  })

  it('does not letterbox a box derived from the item itself', () => {
    // That box IS the shape the media would have taken, so it can keep flowing
    // normally — no reason to absolutely position every image on the site.
    expect(resolveMediaBox('Disabled', 608, 1080).isLetterboxed).toBe(false)
  })

  it('reserves nothing when dimensions are unknown', () => {
    // Records predating the backfill. Reserving nothing means the old
    // measure-on-load behaviour, which is correct — just jumpy.
    for (const dims of [
      [undefined, undefined],
      [1920, undefined],
      [undefined, 1080],
    ] as const) {
      expect(resolveMediaBox('Disabled', dims[0], dims[1])).toEqual({
        aspectRatio: null,
        isLetterboxed: false,
      })
    }
  })

  it('treats zero and negative dimensions as unknown', () => {
    // A failed probe leaves zeroes. `aspect-ratio: 1920 / 0` is invalid and
    // `0 / 0` collapses the card, so both have to fall through to no box.
    expect(resolveMediaBox('Disabled', 0, 0).aspectRatio).toBeNull()
    expect(resolveMediaBox('Disabled', 1920, 0).aspectRatio).toBeNull()
    expect(resolveMediaBox('Disabled', -1, -1).aspectRatio).toBeNull()
  })

  it('lets the user’s ratio win over the item’s own shape', () => {
    // Whole point of the setting: every card the same shape, whatever it holds.
    const box = resolveMediaBox('4:5', 1920, 1080)
    expect(box).toEqual({ aspectRatio: '4 / 5', isLetterboxed: true })
  })

  it('applies the uniform ratio even with no stored dimensions', () => {
    // It needs nothing from the backend, which is why it works across the whole
    // archive from the moment it's toggled on.
    expect(resolveMediaBox('16:9', undefined, undefined)).toEqual({
      aspectRatio: '16 / 9',
      isLetterboxed: true,
    })
  })

  it('maps every offered ratio', () => {
    // A ratio in the settings tabs with no mapping here would silently do
    // nothing.
    for (const [setting, expected] of [
      ['16:9', '16 / 9'],
      ['1:1', '1 / 1'],
      ['4:5', '4 / 5'],
    ] as const) {
      expect(resolveMediaBox(setting, undefined, undefined).aspectRatio).toBe(expected)
    }
  })

  it('survives a persisted setting from a future or hand-edited build', () => {
    // localStorage is user-writable; an unmapped value must fall through to the
    // item's own shape rather than producing `aspect-ratio: undefined`.
    expect(resolveMediaBox('21:9' as never, 1920, 1080).aspectRatio).toBe('1920 / 1080')
    expect(resolveMediaBox(undefined, 1920, 1080).aspectRatio).toBe('1920 / 1080')
  })
})

describe('tallestAspectRatio', () => {
  it('picks the item that is tallest at a fixed width', () => {
    // Tallest = smallest width/height. 608/1080 (0.56) beats 1920/1080 (1.78).
    expect(
      tallestAspectRatio([
        { width: 1920, height: 1080 },
        { width: 608, height: 1080 },
        { width: 1080, height: 1080 },
      ]),
    ).toBe('608 / 1080')
  })

  it('returns the shared ratio when a set agrees, so nothing is letterboxed', () => {
    // The common case — one set is one performance from one camera. Reserving
    // the tallest costs exactly nothing here.
    expect(
      tallestAspectRatio([
        { width: 1920, height: 1080 },
        { width: 1920, height: 1080 },
      ]),
    ).toBe('1920 / 1080')
  })

  it('bails out when any item has no dimensions', () => {
    // A floor computed from a subset would be too short for whatever it couldn't
    // see, which is the jump it was supposed to prevent.
    expect(
      tallestAspectRatio([
        { width: 1920, height: 1080 },
        { width: undefined, height: undefined },
      ]),
    ).toBeNull()
    expect(tallestAspectRatio([{ width: 1920, height: 0 }])).toBeNull()
  })

  it('returns null for an empty set', () => {
    expect(tallestAspectRatio([])).toBeNull()
  })

  it('handles a single item', () => {
    expect(tallestAspectRatio([{ width: 800, height: 600 }])).toBe('800 / 600')
  })
})

describe('the tallness clamp', () => {
  // The regression this exists for. The cap started as a flat 800px max-height,
  // which is the wrong unit for a grid whose card width follows the column count:
  // it bit harder the WIDER the card, so an ordinary 9:16 portrait clip was
  // untouched at four columns but letterboxed with 50px of dead space either side
  // at three, and 193px at two. Clamping the ratio scales with the card instead.
  it('leaves every standard portrait format alone', () => {
    for (const [w, h] of [
      [1080, 1920], // 9:16, the common fancam crop
      [1080, 1620], // 2:3
      [1080, 1440], // 3:4
      [1080, 1350], // 4:5
      [1920, 1080], // and landscape, obviously
      [1000, 2000], // exactly 2:1 — the boundary is inclusive
    ] as const) {
      expect(resolveMediaBox('Disabled', w, h).aspectRatio).toBe(`${w} / ${h}`)
      expect(tallestAspectRatio([{ width: w, height: h }])).toBe(`${w} / ${h}`)
    }
  })

  it('clamps media taller than 2:1', () => {
    // A stitched image or long screenshot, which is what made a card run several
    // screens long.
    expect(resolveMediaBox('Disabled', 1080, 4000).aspectRatio).toBe('1 / 2')
    expect(resolveMediaBox('Disabled', 1000, 2001).aspectRatio).toBe('1 / 2')
  })

  it('clamps a set whose tallest item is extreme, without punishing the rest', () => {
    // The set box takes the tallest item's shape, so one outlier used to stretch
    // every step of the carousel. Clamped, the outlier is the only thing that has
    // to letterbox.
    expect(
      tallestAspectRatio([
        { width: 1920, height: 1080 },
        { width: 1080, height: 5000 },
      ]),
    ).toBe('1 / 2')
  })

  it('still returns the real ratio when the tallest is within the limit', () => {
    expect(
      tallestAspectRatio([
        { width: 1920, height: 1080 },
        { width: 1080, height: 1920 },
      ]),
    ).toBe('1080 / 1920')
  })
})
