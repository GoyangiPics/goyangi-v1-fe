/**
 * How many grid gifs may play at once.
 *
 * Eight H.264 720p streams is comfortably inside any GPU's decoder budget; a
 * four-column desktop grid shows about twenty cards, and letting all twenty
 * decode is what made the whole page stutter. Phones show fewer than eight at
 * a time, so the cap never bites there.
 */
export const MAX_CONCURRENT_GIFS = 8

export interface RankedItem<T> {
  item: T
  /** Viewport-relative, as from getBoundingClientRect(). */
  top: number
  bottom: number
}

/**
 * Picks which visible items may play: the `max` nearest the viewport's vertical
 * centre, with a little hysteresis so scrolling a few pixels doesn't swap the
 * eighth and ninth card back and forth (each swap is a decoder re-init).
 *
 * An item that was already playing keeps its slot if it still ranks within
 * `slack` places of the cut, evicting the lowest-ranked newcomer instead — but
 * only a newcomer that is itself within `slack` places of the cut. Hysteresis is
 * about the boundary; a new item at the centre of the viewport is not a
 * boundary case. Without that limit, a set card stepping to its next clip
 * froze: the swap freed a slot, the next card down took it, and when the new
 * clip reported visible a frame later it was the only "newcomer" on the list,
 * so the card that had just taken the slot evicted it from dead centre.
 *
 * With `max` or fewer visible, everything plays.
 */
export function pickPlayable<T>(
  items: readonly RankedItem<T>[],
  viewportHeight: number,
  max: number,
  previous: ReadonlySet<T>,
  slack = 2,
): Set<T> {
  const centre = viewportHeight / 2
  const distance = (i: RankedItem<T>) => Math.abs((i.top + i.bottom) / 2 - centre)
  const sorted = items.toSorted((a, b) => distance(a) - distance(b))
  if (sorted.length <= max) return new Set(sorted.map((i) => i.item))

  const chosen = sorted.slice(0, max).map((i) => i.item)
  const holdovers = sorted
    .slice(max, max + slack)
    .map((i) => i.item)
    .filter((i) => previous.has(i))
  const boundary = Math.max(0, max - slack)
  for (const holdover of holdovers) {
    const newcomer = chosen.findLastIndex((i, rank) => rank >= boundary && !previous.has(i))
    if (newcomer === -1) break
    chosen.splice(newcomer, 1)
    chosen.push(holdover)
  }
  return new Set(chosen)
}
