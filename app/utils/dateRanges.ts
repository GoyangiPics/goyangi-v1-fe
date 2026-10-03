import { MostLikedModes } from '~/types/typesFilters'

/**
 * Compute the date window for a `MostLikedModes` preset, anchored to "now".
 * Single source of truth shared by the filters store (writes initial values
 * when the preset is toggled) and the fetch composable (re-derives a fresh
 * window every fetch so a preset that was set days ago still reflects the
 * intended window — e.g. "Most liked this week" stays week-relative).
 */
export function calculateDateRange(mode: MostLikedModes): { startDate: Date; endDate: Date } {
  const endDate = new Date()
  const startDate = new Date()

  switch (mode) {
    case MostLikedModes.AllTime:
      startDate.setFullYear(2000, 0, 1)
      break
    case MostLikedModes.OneYear:
      startDate.setFullYear(endDate.getFullYear() - 1)
      break
    case MostLikedModes.SixMonths:
      startDate.setMonth(endDate.getMonth() - 6)
      break
    case MostLikedModes.ThreeMonths:
      startDate.setMonth(endDate.getMonth() - 3)
      break
    case MostLikedModes.OneMonth:
      startDate.setMonth(endDate.getMonth() - 1)
      break
    case MostLikedModes.OneWeek:
      startDate.setDate(endDate.getDate() - 7)
      break
  }

  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(23, 59, 59, 999)

  return { startDate, endDate }
}

const pad = (n: number) => n.toString().padStart(2, '0')

/** Format a Date as `YYYY-MM-DD HH:MM:SS` (the format PocketBase expects). */
export function formatPbDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
