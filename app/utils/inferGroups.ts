import type { Group, Idol } from '~/types/appTypes'

/**
 * The groups implied by a set of idols.
 *
 * Group is never chosen directly anywhere in the app — it is always derived from
 * the selected idols, so the two can't disagree. This existed as an identical
 * inline computed in uploads.vue and the post edit form, and the set-edit dialog
 * would have been a third copy.
 */
export function inferGroups(idols: Idol[], allGroups: Group[]): Group[] {
  const groupIds = [...new Set(idols.map((i) => i.group).filter(Boolean))]
  return groupIds
    .map((id) => allGroups.find((g) => g.id === id))
    .filter((g): g is Group => g !== undefined)
}
