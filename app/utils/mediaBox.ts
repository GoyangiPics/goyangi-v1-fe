import type { UniformCardRatio } from '~/types/typesSettings'

/**
 * What shape to reserve for a card's media, before the file has loaded.
 *
 * Two separate problems, one answer. A card has no height until its media
 * arrives, so the masonry grid reflows on first paint; and stepping through a set
 * whose items have different ratios resizes the card under the cursor. Giving the
 * media box an `aspect-ratio` up front fixes the first for every card that has
 * stored dimensions, and the uniform setting fixes the second outright by making
 * every card the same shape.
 *
 * Pure, so the decision table is testable without mounting anything — the
 * fallbacks are the whole substance of it.
 */

/** CSS `aspect-ratio` values for the uniform setting's ratios. */
const RATIO_VALUES: Record<Exclude<UniformCardRatio, 'Disabled'>, string> = {
  '16:9': '16 / 9',
  '1:1': '1 / 1',
  '4:5': '4 / 5',
}

/**
 * How many times taller than wide a card's media box may get.
 *
 * An aspect-ratio box has no upper bound of its own: height is width ÷ ratio, so
 * a very tall item on a wide column produces a card several screens long. A SET
 * makes that worse, because the box takes the tallest item's shape, so one
 * outlier stretches every step of the carousel to match it.
 *
 * # Why a ratio and not a pixel height
 *
 * This started as a flat 800px ceiling, and that is the wrong unit for a grid
 * whose card width depends on the column count. A pixel cap bites HARDER the
 * wider the card: at 1920px it left an ordinary 9:16 portrait clip untouched at
 * four columns, but letterboxed it with 50px bars either side at three and 193px
 * at two — the box was capped shorter than the media's own shape, so
 * object-contain had to shrink it to fit and the card had visible dead space.
 *
 * Capping the ratio scales instead: the ceiling is 2× whatever the card happens
 * to be, so at four columns on a 1080p screen it lands at ~810px (where the pixel
 * cap was) and at six columns ~530px. And 2:1 clears every standard portrait
 * format — 9:16 is 1.78, 2:3 is 1.5, 3:4 is 1.33, 4:5 is 1.25 — so normal content
 * never letterboxes at any column count. Only genuinely extreme media (stitched
 * images, long screenshots) is capped, which is the case worth capping.
 *
 * Cards only. The fullscreen viewer and the single-content page have their own
 * markup and should show the item at whatever size it actually is.
 */
export const MAX_BOX_TALLNESS = 2

/**
 * The CSS `aspect-ratio` for stored dimensions, no taller than MAX_BOX_TALLNESS.
 *
 * Clamping here rather than in CSS is what keeps the media and its box the same
 * shape: a box clamped by `max-height` still *declares* the media's ratio, so the
 * two disagree and the media letterboxes inside it. A clamped ratio is a shape
 * the box and the media can share.
 */
function boxRatio(width: number, height: number): string {
  if (height > width * MAX_BOX_TALLNESS) return `1 / ${MAX_BOX_TALLNESS}`
  return `${width} / ${height}`
}

export interface MediaBox {
  /** CSS `aspect-ratio`, or null to leave the media at its intrinsic size. */
  aspectRatio: string | null
  /**
   * True when the media has to fit a box it didn't choose, so it needs
   * `object-contain` and absolute fill rather than `w-full`.
   *
   * Only set for the uniform setting. A box derived from the item's OWN
   * dimensions is the shape it would have taken anyway, so the media can keep
   * flowing normally inside it — which avoids absolutely positioning every image
   * on the site for no reason.
   */
  isLetterboxed: boolean
}

const NO_BOX: MediaBox = { aspectRatio: null, isLetterboxed: false }

/**
 * @param setting  The user's uniform-ratio preference.
 * @param width    Stored pixel width, if the record has one.
 * @param height   Stored pixel height, if the record has one.
 */
export function resolveMediaBox(
  setting: UniformCardRatio | undefined,
  width: number | undefined,
  height: number | undefined,
): MediaBox {
  // The user's choice wins over the item's own shape — that's the point of it.
  if (setting && setting !== 'Disabled') {
    const value = RATIO_VALUES[setting]
    if (value) return { aspectRatio: value, isLetterboxed: true }
  }

  // Records uploaded before the backend stored dimensions have none, and a
  // failed probe leaves zeroes. Both mean "unknown", and reserving a box from
  // them would be worse than reserving nothing: `aspect-ratio: 1920 / 0` is
  // invalid, and `0 / 0` collapses the card.
  if (!width || !height || width <= 0 || height <= 0) return NO_BOX

  return { aspectRatio: boxRatio(width, height), isLetterboxed: false }
}

/**
 * The tallest box a set needs, as a CSS `aspect-ratio`.
 *
 * Answers "how would we know the tallest?" — the tallest item at a fixed column
 * width is the one with the smallest width/height, so with dimensions stored it
 * is just a min. Returns null when ANY item is missing dimensions: a floor
 * computed from a subset would be too short for whatever it couldn't see, which
 * puts the jump right back.
 *
 * Not used while the uniform setting is on, since that already fixes the shape.
 */
export function tallestAspectRatio(
  items: Array<{ width?: number; height?: number }>,
): string | null {
  if (items.length === 0) return null

  let tallest: { width: number; height: number } | null = null
  for (const item of items) {
    const { width, height } = item
    if (!width || !height || width <= 0 || height <= 0) return null
    if (!tallest || width / height < tallest.width / tallest.height) {
      tallest = { width, height }
    }
  }

  return tallest ? boxRatio(tallest.width, tallest.height) : null
}
