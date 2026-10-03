import type { Group, Idol } from '~/types/appTypes'
import { computed, ref } from 'vue'

/** One group and its members, for a headed list. */
export interface GroupedIdols {
  gid: string
  label: string
  items: Array<Idol & { groupName: string }>
}

/**
 * Idols grouped under their group, with search and tri-state group toggling.
 *
 * Extracted once there was a second consumer. The filter dialog had ~90 lines of
 * this; the star manager needs the same grouping, the same search-that-keeps-
 * headers-attached, and the same "is this whole group selected?" tri-state.
 *
 * Deliberately does NOT include the filter dialog's collapse-when-all-selected
 * behaviour, where selecting every member of a group rewrites the selection as a
 * single group entry. That's a display compression that only makes sense for
 * filters — for stars it would silently convert "I starred these 9 idols" into "I
 * starred the group", which are different subscriptions and drift apart as the
 * group's lineup changes.
 *
 * @param selected the caller's selection, read for the tri-state and search
 * @param allIdols every idol
 * @param allGroups every group
 */
export function useGroupedIdolSelection(
  selected: () => Array<{ id: string }>,
  allIdols: () => Idol[],
  allGroups: () => Group[],
) {
  const searchTerm = ref('')

  const groupedIdols = computed<GroupedIdols[]>(() => {
    const map = new Map<string, Idol[]>()
    for (const idol of allIdols()) {
      const gid = (idol as any).group || '__none__'
      if (!map.has(gid)) map.set(gid, [])
      map.get(gid)!.push(idol)
    }
    return [...map.entries()]
      .map(([gid, items]) => {
        const groupName = allGroups().find((g) => g.id === gid)?.name ?? 'Other'
        return {
          gid,
          label: groupName,
          items: items
            .toSorted((a, b) => a.name.localeCompare(b.name))
            .map((idol) => ({ ...idol, groupName })),
        }
      })
      .toSorted((a, b) => a.label.localeCompare(b.label))
  })

  /**
   * Groups filtered by the search term, headers kept attached to their surviving
   * members.
   *
   * A group whose *name* matches keeps all of its members, so searching "IVE"
   * lists the whole group rather than nothing.
   */
  const filteredGroups = computed<GroupedIdols[]>(() => {
    const term = searchTerm.value.trim().toLowerCase()
    if (!term) return groupedIdols.value

    const out: GroupedIdols[] = []
    for (const group of groupedIdols.value) {
      const groupMatches = group.label.toLowerCase().includes(term)
      const items = group.items.filter((i) => groupMatches || i.name.toLowerCase().includes(term))
      if (items.length) out.push({ ...group, items })
    }
    return out
  })

  /** Tri-state for a group header checkbox over the given members. */
  function groupCheckState(items: Array<{ id: string }>): true | false | 'indeterminate' {
    if (items.length === 0) return false
    const ids = new Set(selected().map((s) => s.id))
    const hits = items.filter((i) => ids.has(i.id)).length
    if (hits === 0) return false
    if (hits === items.length) return true
    return 'indeterminate'
  }

  return { searchTerm, groupedIdols, filteredGroups, groupCheckState }
}
