/**
 * How many masonry columns fit, given the user's ceiling and the viewport.
 *
 * Pure and split out of useResponsiveColumns because the thresholds ARE the
 * feature: columns stretch to fill (ContentGrid uses flex-1), so a count that
 * doesn't fit doesn't overflow or wrap — it silently shrinks every card. A wrong
 * boundary here is invisible in review and only shows up as "why are the cards
 * tiny on my laptop".
 */

/** ContentGrid's default `gap-6`. */
export const GRID_GAP_PX = 24

/**
 * Horizontal chrome either side of the grid, TOTAL, at a given viewport width.
 *
 * Mirrors the layout's responsive padding (`p-6 xl:px-12 2xl:px-24`) plus main's
 * `px-4`, doubled. It has to be a function of width rather than the constant it
 * used to be, because the padding now grows on big screens: edge-to-edge content
 * on a 24" 1080p monitor reads as stretched, and 40px of margin wasn't enough to
 * frame it.
 *
 * Keep in step with app/layouts/default.vue — the two encode the same layout, and
 * only this half is testable.
 */
export function gridChromeAt(width: number): number {
  // Tailwind's 2xl / xl breakpoints. px-24 = 96px, px-12 = 48px, p-6 = 24px.
  const layoutPad = width >= 1536 ? 96 : width >= 1280 ? 48 : 24
  return (layoutPad + 16) * 2
}

/**
 * The narrowest card any column count is allowed to produce.
 *
 * Lowered from 320 (what a 4-column setting produced on a 1440px screen) so six
 * columns can fit a 1920px monitor at all — at that width, six columns inside the
 * new margins is a ~263px card. That is narrower than the site used to go and
 * deliberately so: a six-column grid is a contact sheet, and the cards in it are
 * being scanned rather than watched. Every threshold in the ladder below is
 * checked against this in the tests.
 */
export const MIN_CARD_WIDTH_PX = 255

/**
 * Viewport width at which each column count becomes available, derived from
 * MIN_CARD_WIDTH_PX and gridChromeAt and rounded to a round number.
 *
 * The first three entries are the original hand-written ladder, untouched:
 * phones and tablets are not what any of this is about, and their card widths are
 * comfortably above the floor already. The 1600 and 1900 steps are what let a
 * 1080p desktop reach five and six columns, which it previously could not — six
 * used to need 2160px, i.e. a 1440p screen.
 */
const LADDER: Array<{ maxWidth: number; maxColumns: number }> = [
  { maxWidth: 640, maxColumns: 1 },
  { maxWidth: 1024, maxColumns: 2 },
  { maxWidth: 1280, maxColumns: 3 },
  { maxWidth: 1600, maxColumns: 4 },
  { maxWidth: 1900, maxColumns: 5 },
]

/**
 * @param userSetting The user's ceiling, already parsed. Never exceeded.
 * @param width       Viewport width. 0 means "not measured yet" (SSR, first
 *                    tick), where the setting is honoured as-is rather than
 *                    collapsing the grid to one column and reflowing on hydrate.
 */
export function resolveColumnCount(userSetting: number, width: number): number {
  const ceiling = Number.isFinite(userSetting) && userSetting > 0 ? Math.floor(userSetting) : 3
  if (width === 0) return ceiling

  for (const step of LADDER) {
    if (width < step.maxWidth) return Math.min(ceiling, step.maxColumns)
  }
  return ceiling
}

/**
 * Rendered width of one card, for reasoning about (and testing) the ladder.
 *
 * `cap` is the layout's max-width — past it the extra viewport goes to margins,
 * so the cards stop growing. The chrome is taken from the VIEWPORT width, since
 * that is what the media queries see, while the available space comes from the
 * capped width.
 */
export function cardWidthAt(width: number, columns: number, cap: number): number {
  const available = Math.min(width, cap) - gridChromeAt(width)
  return (available - GRID_GAP_PX * (columns - 1)) / columns
}
