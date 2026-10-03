import { describe, expect, it } from 'vitest'
import {
  cardWidthAt,
  gridChromeAt,
  MIN_CARD_WIDTH_PX,
  resolveColumnCount,
} from '~/utils/responsiveColumns'

/** The layout's max-width, 160rem. */
const CAP = 2560

/** Every column count the settings offer. */
const COUNTS = [1, 2, 3, 4, 5, 6] as const

/** The ladder's own thresholds, and the count each one unlocks. */
const THRESHOLDS = [
  [640, 2],
  [1024, 3],
  [1280, 4],
  [1600, 5],
  [1900, 6],
] as const

describe('resolveColumnCount', () => {
  it('treats the setting as a ceiling, never a target', () => {
    // The whole contract. Someone who picked 2 must keep getting 2 on a 4K
    // display, however much room there is.
    for (const width of [1280, 1920, 2560, 3440, 7680]) {
      expect(resolveColumnCount(2, width)).toBe(2)
    }
  })

  it('clamps down on narrow viewports', () => {
    expect(resolveColumnCount(6, 375)).toBe(1)
    expect(resolveColumnCount(6, 800)).toBe(2)
    expect(resolveColumnCount(6, 1100)).toBe(3)
  })

  it('leaves phone and tablet widths exactly where they were', () => {
    // The first three ladder steps are untouched by the desktop retuning, and
    // this is the guard that keeps it that way.
    for (const setting of COUNTS) {
      expect(resolveColumnCount(setting, 375)).toBe(1)
      expect(resolveColumnCount(setting, 639)).toBe(1)
      expect(resolveColumnCount(setting, 640)).toBe(Math.min(setting, 2))
      expect(resolveColumnCount(setting, 1023)).toBe(Math.min(setting, 2))
      expect(resolveColumnCount(setting, 1024)).toBe(Math.min(setting, 3))
      expect(resolveColumnCount(setting, 1279)).toBe(Math.min(setting, 3))
    }
  })

  it('lets a 1080p desktop reach six columns', () => {
    // The point of the retuning: six columns used to require 2160px, so a 24"
    // 1080p monitor — the most common desktop there is — could never show them.
    expect(resolveColumnCount(6, 1920)).toBe(6)
    expect(resolveColumnCount(5, 1920)).toBe(5)
  })

  it('unlocks each count exactly at its threshold and not one pixel before', () => {
    for (const [width, count] of THRESHOLDS) {
      expect(resolveColumnCount(count, width)).toBe(count)
      expect(resolveColumnCount(count, width - 1)).toBe(count - 1)
    }
  })

  it('honours the setting before the viewport is measured', () => {
    // width 0 is SSR and the first client tick. Returning 1 there would render a
    // single column and reflow the whole grid on hydrate.
    expect(resolveColumnCount(4, 0)).toBe(4)
    expect(resolveColumnCount(6, 0)).toBe(6)
  })

  it('falls back to 3 on a malformed setting', () => {
    // Number.parseInt on hand-edited localStorage.
    for (const bad of [Number.NaN, 0, -2, Number.POSITIVE_INFINITY]) {
      expect(resolveColumnCount(bad, 1920)).toBe(3)
    }
  })
})

describe('the ladder never produces a card below the floor', () => {
  // The reason the thresholds exist at all. Columns stretch to fill, so a count
  // that doesn't fit shrinks every card silently instead of overflowing — these
  // assertions are the only thing standing between a new threshold and a grid of
  // postage stamps.
  it('holds at every threshold', () => {
    for (const [width, count] of THRESHOLDS) {
      expect(cardWidthAt(width, count, CAP)).toBeGreaterThanOrEqual(MIN_CARD_WIDTH_PX)
    }
  })

  it('holds at real-world viewport widths, for whatever the ladder allows there', () => {
    for (const width of [
      375, 414, 768, 1024, 1280, 1366, 1440, 1512, 1536, 1600, 1680, 1728, 1920, 2160, 2560, 3440,
    ]) {
      const columns = resolveColumnCount(6, width)
      expect(cardWidthAt(width, columns, CAP)).toBeGreaterThanOrEqual(MIN_CARD_WIDTH_PX)
    }
  })
})

describe('gridChromeAt', () => {
  it('grows with the breakpoints the layout uses', () => {
    // p-6 → xl:px-12 → 2xl:px-24, each plus main's px-4, doubled.
    expect(gridChromeAt(1279)).toBe((24 + 16) * 2)
    expect(gridChromeAt(1280)).toBe((48 + 16) * 2)
    expect(gridChromeAt(1535)).toBe((48 + 16) * 2)
    expect(gridChromeAt(1536)).toBe((96 + 16) * 2)
    expect(gridChromeAt(2560)).toBe((96 + 16) * 2)
  })
})

describe('cardWidthAt', () => {
  it('gives a 1080p desktop a real margin without costing it a column', () => {
    // The competing halves of the retuning: 112px either side rather than 40,
    // and six columns still clearing the floor at that width.
    expect(gridChromeAt(1920) / 2).toBe(112)
    expect(cardWidthAt(1920, 6, CAP)).toBeCloseTo(263, 0)
    expect(cardWidthAt(1920, 4, CAP)).toBeCloseTo(406, 0)
  })

  it('stops growing past the cap', () => {
    // A 3440px ultrawide gets the same layout as 2560 — deliberately, since a row
    // wider than that becomes neck work to read.
    expect(cardWidthAt(3440, 4, CAP)).toBe(cardWidthAt(2560, 4, CAP))
  })

  it('takes the chrome from the viewport but the space from the capped width', () => {
    // An ultrawide is past the cap, so its content is 2560 wide — but it is still
    // above the 2xl breakpoint, so it pays the large padding.
    expect(cardWidthAt(3440, 1, CAP)).toBe(2560 - gridChromeAt(3440))
  })
})
