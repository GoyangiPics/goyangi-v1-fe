import type { Label } from '~/types/appTypes'

/**
 * Writes a content record's new label list onto its `expand` in place.
 *
 * CardChips renders from `content.expand.labels`, and the listing arrays hold
 * these same objects, so patching here updates every card showing the record
 * with no refetch. Same in-place approach useLikeItem/useLikeAll take for
 * `expand.likes`.
 *
 * `expand` is absent on records fetched without one, hence the guard: assigning
 * straight through would throw on those.
 */
export function applyLabelsToContent(
  content: { expand?: { labels?: Label[] } } | null | undefined,
  labels: Label[],
) {
  if (!content) return
  if (!content.expand) content.expand = {}
  content.expand.labels = labels
}
