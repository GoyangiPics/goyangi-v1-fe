import type { Group, Idol, Label, Tag, Uploader } from '~/types/appTypes'

export type FilterValue = Idol | Group | Uploader | Tag | Label
export type FilterType = 'idol' | 'group' | 'uploader' | 'tag' | 'label'

/**
 * Shared "click a chip to filter by it" behavior used across content/set
 * cards. Resets current filters, sets the single chosen filter, then runs
 * `onApplied` (cards either emit an event or navigate home).
 */
/**
 * Resolve a clicked chip back to the reference-store record it stands for.
 *
 * By id, falling back to name. Name alone was the bug behind "clicking a Chaewon
 * chip filters by the wrong Chaewon": there are several idols to a name, and
 * `find` returns whichever sorts first — so two of the three chips on the site
 * filtered by someone else entirely. The chip already carries the record's id;
 * nothing had been using it.
 *
 * The name fallback stays for values that reach here without an id (an uploader
 * chip built from an expand that only carried the name, say).
 */
function resolveByIdentity<T extends { id?: string; name?: string }>(
  value: FilterValue,
  list: T[],
): T | undefined {
  const byId = value.id ? list.find((item) => item.id === value.id) : undefined
  return byId ?? list.find((item) => item.name === value.name)
}

export function useFilterApply(onApplied?: () => void) {
  const filtersStore = useFiltersStore()
  const referenceStore = useReferenceStore()

  function filtersApply(value: FilterValue, type: FilterType) {
    filtersStore.reset()

    if (type === 'idol') {
      const idol = resolveByIdentity(value, referenceStore.idols)
      if (idol) filtersStore.filters.idol.push(idol)
    } else if (type === 'group') {
      const group = resolveByIdentity(value, referenceStore.groups)
      if (group) filtersStore.filters.group.push(group)
    } else if (type === 'uploader') {
      const uploader = resolveByIdentity(value, referenceStore.uploaders)
      if (uploader) filtersStore.filters.uploader.push(uploader)
    } else if (type === 'tag') {
      const tag = resolveByIdentity(value, referenceStore.tags)
      if (tag) filtersStore.filters.tag.push(tag)
    } else if (type === 'label') {
      // Unlike the others, this can't resolve through referenceStore: labels are
      // user-created and unbounded, so they're fetched on demand rather than
      // loaded wholesale at session start. The chip already carries everything
      // the filter clause needs.
      const label = value as Label
      filtersStore.filters.label.push({ id: label.id, name: label.name, slug: label.slug })
    }

    onApplied?.()
  }

  return { filtersApply }
}
