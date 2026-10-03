import type { Group, Idol } from '~/types/appTypes'

export interface IdolChip {
  key: string
  /**
   * Display text. Qualified with the group ("Chaewon · LE SSERAFIM") when the
   * bare name belongs to more than one idol — see idolDisplayName.
   */
  label: string
  /** Set when the chip stands for a whole group of idols. */
  groupId?: string
  /** Set when the chip is a single idol. */
  idol?: Idol
}

/**
 * Separator between an idol's name and its qualifying group in a URL token.
 *
 * `~` because it is unreserved in a query string (so it survives a round trip
 * unescaped and keeps shared links readable) and no idol or group name contains
 * one.
 */
export const IDOL_GROUP_SEPARATOR = '~'

/**
 * Lowercased names carried by more than one idol.
 *
 * There are three Chaewons, two Yunas and so on, and until now nothing in the
 * app distinguished them: chips read "Chaewon", the URL said `idol=Chaewon`, and
 * every lookup was a `find` on name — which silently resolved to whichever one
 * happens to sort first.
 */
function duplicatedNames(allIdols: Idol[]): Set<string> {
  const seen = new Set<string>()
  const duplicated = new Set<string>()
  for (const idol of allIdols) {
    const name = idol.name.toLowerCase()
    if (seen.has(name)) duplicated.add(name)
    else seen.add(name)
  }
  return duplicated
}

/** The idol's group name, or null when it has none (or the group is unknown). */
function groupNameOf(idol: Idol, groups: Group[]): string | null {
  if (!idol.group) return null
  return groups.find((g) => g.id === idol.group)?.name ?? null
}

/**
 * What to show for one idol: the bare name normally, qualified by group when
 * that name is shared. Only ambiguous names get the suffix, so the common case
 * stays short.
 */
export function idolDisplayName(idol: Idol, allIdols: Idol[], groups: Group[]): string {
  if (!duplicatedNames(allIdols).has(idol.name.toLowerCase())) return idol.name
  const group = groupNameOf(idol, groups)
  return group ? `${idol.name} · ${group}` : idol.name
}

/**
 * The `?idol=` token for one idol — `Chaewon`, or `Chaewon~LE SSERAFIM` when the
 * name alone would be ambiguous.
 *
 * Qualified only when needed, so the vast majority of shared links are unchanged
 * and stay readable.
 */
export function idolQueryToken(idol: Idol, allIdols: Idol[], groups: Group[]): string {
  if (!duplicatedNames(allIdols).has(idol.name.toLowerCase())) return idol.name
  const group = groupNameOf(idol, groups)
  return group ? `${idol.name}${IDOL_GROUP_SEPARATOR}${group}` : idol.name
}

/**
 * Inverse of idolQueryToken.
 *
 * An unqualified token still resolves — links shared before this existed, and
 * hand-written ones, must keep working — but it can only fall back to the first
 * idol carrying that name, which is exactly the ambiguity the qualifier removes.
 */
export function resolveIdolToken(
  token: string,
  allIdols: Idol[],
  groups: Group[],
): Idol | undefined {
  const cut = token.indexOf(IDOL_GROUP_SEPARATOR)
  if (cut === -1) return allIdols.find((i) => i.name === token)

  const name = token.slice(0, cut)
  const groupName = token.slice(cut + IDOL_GROUP_SEPARATOR.length)
  const group = groups.find((g) => g.name === groupName)
  return (
    (group && allIdols.find((i) => i.name === name && i.group === group.id)) ??
    allIdols.find((i) => i.name === name)
  )
}

/**
 * Collapses a multi-idol selection for display: when every idol of a group
 * is selected, the group is shown as one chip instead of N idol chips.
 * Shared by the upload form and the Filterbar.
 */
export function collapseIdolSelection(
  selected: Idol[],
  allIdols: Idol[],
  groups: Group[],
): IdolChip[] {
  const byGroup = new Map<string, Idol[]>()
  const noGroup: Idol[] = []
  for (const idol of selected) {
    if (idol.group) {
      if (!byGroup.has(idol.group)) byGroup.set(idol.group, [])
      byGroup.get(idol.group)!.push(idol)
    } else {
      noGroup.push(idol)
    }
  }

  const chips: IdolChip[] = []
  for (const [gid, groupSelected] of byGroup) {
    const allInGroup = allIdols.filter((i) => i.group === gid)
    if (allInGroup.length > 0 && groupSelected.length === allInGroup.length) {
      const grp = groups.find((g) => g.id === gid)
      chips.push({ key: `group-${gid}`, label: grp?.name ?? gid, groupId: gid })
    } else {
      groupSelected.forEach((idol) =>
        chips.push({
          key: `idol-${idol.id}`,
          label: idolDisplayName(idol, allIdols, groups),
          idol,
        }),
      )
    }
  }
  noGroup.forEach((idol) =>
    chips.push({ key: `idol-${idol.id}`, label: idolDisplayName(idol, allIdols, groups), idol }),
  )
  return chips
}
