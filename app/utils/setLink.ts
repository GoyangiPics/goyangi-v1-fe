/**
 * Where a set's title, card or row should navigate.
 *
 * A set that holds exactly one item is a set only by accident of how content is
 * ingested — /set/<id> for it is a listing page with a single card on it, one
 * click short of the thing you actually wanted. Those link straight to the item.
 *
 * Deliberately keyed on the set's real child count, NOT on whatever the active
 * filters left visible: a five-item set narrowed to one by a filter is still a
 * five-item set, and sending its title to /single/ would make the destination
 * depend on the filter bar.
 *
 * Sets only. A one-item collection stays a collection — it is a container the
 * user made on purpose, and skipping past it would hide the thing they built.
 */

/** A set record with its children expanded, as SET_EXPAND / UNIFIED_SET_EXPAND return them. */
type ExpandedSet = { id: string; expand?: unknown } | null | undefined

/** The set's children, or an empty list when the expand is absent. */
export function setContents(set: ExpandedSet): Array<{ id: string }> {
  return ((set?.expand as any)?.contents_via_set ?? []) as Array<{ id: string }>
}

/** The id of the set's only content, or null when it holds none or several. */
export function soleSetContentId(set: ExpandedSet): string | null {
  const contents = setContents(set)
  return contents.length === 1 ? (contents[0]?.id ?? null) : null
}

/** `/single/<contentId>` for a one-item set, `/set/<id>` otherwise. */
export function setHref(set: ExpandedSet): string {
  const sole = soleSetContentId(set)
  return sole ? `/single/${sole}` : `/set/${set?.id}`
}
