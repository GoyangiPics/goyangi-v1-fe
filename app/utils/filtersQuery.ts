import type { Group, Idol } from '~/types/appTypes'
import type { Filters, MostLikedModes } from '~/types/typesFilters'
import { collapseIdolSelection, idolQueryToken } from '~/utils/idolSelection'

/**
 * Serialize active filters into a URL query string.
 * Collapses fully-selected idol groups into a single `group=` entry so links
 * stay short (e.g. selecting every TWICE member becomes `group=TWICE`).
 *
 * `searchValue` lives beside `filters` on the store rather than inside it, which
 * is why it is a separate argument — but it belongs in the URL like every other
 * dimension. Leaving it out made the query an incomplete picture of what was
 * applied, and two things depended on it being complete: a shared link dropped
 * the search term, and the logo's "start over" (which relies on the query
 * emptying to trigger a refetch) did nothing at all when a search was the only
 * active filter, because the query was already empty.
 */
export function serializeFiltersToQuery(
  filters: Filters,
  allIdols: Idol[],
  allGroups: Group[],
  defaultSortValue: string | undefined,
  searchValue?: string | null,
  mostLikedMode?: MostLikedModes | null,
): string {
  const queryParts: string[] = []

  // Trimmed, so whitespace never becomes a query param. First, so a shared link
  // reads with its search term up front.
  const search = searchValue?.trim()
  if (search) queryParts.push(`search=${encodeURIComponent(search)}`)

  // The Top Posts window. In the URL for the same reason as the search term:
  // the URL is the whole filter state (nothing is persisted), so a mode that
  // lived only in memory would not survive a reload or a back.
  if (mostLikedMode) queryParts.push(`top=${encodeURIComponent(mostLikedMode)}`)

  if (filters.idol.length) {
    const chips = collapseIdolSelection(filters.idol, allIdols, allGroups)
    // idolQueryToken, NOT the chip's label: the label is display text and now
    // carries a group qualifier for shared names, which is not what the reader
    // on the other end parses. The token is the round-trippable form.
    const idolTokens = chips
      .filter((c) => c.idol)
      .map((c) => idolQueryToken(c.idol!, allIdols, allGroups))
    const groupNames = chips.filter((c) => c.groupId).map((c) => c.label)

    if (idolTokens.length)
      queryParts.push(`idol=${idolTokens.map((n) => encodeURIComponent(n)).join(',')}`)
    if (groupNames.length)
      queryParts.push(`group=${groupNames.map((n) => encodeURIComponent(n)).join(',')}`)
  }

  if (filters.tag.length)
    queryParts.push(`tag=${filters.tag.map((t) => encodeURIComponent(t.name)).join(',')}`)
  if (filters.uploader.length)
    queryParts.push(`uploader=${filters.uploader.map((u) => encodeURIComponent(u.name)).join(',')}`)
  if (filters.filetype.length)
    queryParts.push(
      `filetype=${filters.filetype.map((f) => encodeURIComponent(f.value)).join(',')}`,
    )
  // Optional-chained: a persisted session from before these keys existed reaches
  // here on first render, ahead of the store's afterHydrate backfill.
  if (filters.origin?.length)
    queryParts.push(`origin=${filters.origin.map((o) => encodeURIComponent(o.value)).join(',')}`)
  if (filters.label?.length)
    queryParts.push(`label=${filters.label.map((l) => encodeURIComponent(l.slug)).join(',')}`)

  if (filters.sort && defaultSortValue && filters.sort.value !== defaultSortValue)
    queryParts.push(`sort=${filters.sort.value}`)
  // Only the non-default is written, like sort. It went unserialized for as
  // long as it did nothing, and a link must carry it now that it orders results.
  if (filters.dateMode?.value === 'actual') queryParts.push('datemode=actual')

  if (filters.date.length > 0) {
    const startDate = filters.date[0]?.toISOString().split('T')[0]
    const endDate = filters.date[1]?.toISOString().split('T')[0]
    if (startDate) {
      if (endDate && startDate !== endDate)
        queryParts.push(`date=${encodeURIComponent(startDate)},${encodeURIComponent(endDate)}`)
      else queryParts.push(`date=${encodeURIComponent(startDate)}`)
    }
  }

  return queryParts.join('&')
}
