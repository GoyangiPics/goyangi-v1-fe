/**
 * Parse a PocketBase timestamp ("2026-10-08 12:00:00.000Z").
 *
 * The space separator is PocketBase's, and Safari has historically refused to
 * parse it, so it's swapped for the ISO `T` before parsing. NaN for junk.
 */
export function parsePbTime(value: string | null | undefined): number {
  if (!value) return Number.NaN
  return Date.parse(value.replace(' ', 'T'))
}

/** Whether a record was created after `since` (epoch ms). Nothing is new with no baseline. */
export function isNewSince(created: string | null | undefined, since: number | null): boolean {
  if (since === null) return false
  const t = parsePbTime(created)
  return !Number.isNaN(t) && t > since
}
