/** Format an ISO date string as `YY/MM/DD` for compact card display. */
export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr)
  const yy = String(d.getFullYear()).slice(2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}/${mm}/${dd}`
}

/**
 * Whether an item's own (actual) date says anything its upload date doesn't.
 *
 * Every record has a `date`: the backend fills an unset one with the upload
 * time (hooks/content_date.go). So "has a date" no longer means "someone gave
 * it one" — and the question that matters for display is whether showing it
 * adds anything. It doesn't when it lands on the upload day, whether it was
 * filled in or picked, so this compares the two as they are displayed.
 */
export function hasOwnDate(item: { date?: string | null; created?: string | null }): boolean {
  if (!item.date) return false
  if (!item.created) return true
  return formatShortDate(item.date) !== formatShortDate(item.created)
}
