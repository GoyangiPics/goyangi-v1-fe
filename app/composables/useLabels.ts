import type { Label, LabelJoin } from '~/types/appTypes'
import { ref } from 'vue'

/**
 * The user-created label layer.
 *
 * Read/write split, which is the key thing to understand here: the frontend
 * READS `content.expand.labels` (a denormalised array the backend hook maintains)
 * and WRITES only `contents_labels` join rows. Never write `contents.labels`
 * directly — it's in that collection's updateRule guard list precisely so nobody
 * can strip someone else's labels while the attribution rows survive as orphans.
 *
 * `applyLabel` is the one call that goes through a custom route, because
 * get-or-create isn't expressible as an API rule. Everything else is plain SDK
 * CRUD. Keeping the route call in this one place means swapping it for a
 * client-side find-or-create later is a single-function change.
 */
export function useLabels() {
  const pb = usePocketBase()
  const authStore = useAuthStore()

  const isSearching = ref(false)

  /** Debounce at the call site; this is a plain query. */
  async function searchLabels(term: string, limit = 20): Promise<Label[]> {
    isSearching.value = true
    try {
      const trimmed = term.trim()
      const res = await pb.collection('labels').getList<Label>(1, limit, {
        sort: 'name',
        filter: trimmed ? pb.filter('name~{:term}', { term: trimmed }) : '',
        requestKey: 'labelSearch',
      })
      return res.items
    } catch (error: any) {
      // A superseded search is the SDK auto-cancelling the previous keystroke.
      if (!error?.isAbort) console.error('Label search failed:', error)
      return []
    } finally {
      isSearching.value = false
    }
  }

  /**
   * Applies a label by name, creating it if it doesn't exist.
   *
   * Never errors on a duplicate name: the endpoint resolves an existing label and
   * applies that instead. A free-tag namespace should be find-or-create — the
   * user typed a name, they get that label.
   *
   * `applied: false` means the content already carried it.
   */
  async function applyLabel(
    contentId: string,
    name: string,
  ): Promise<{ label: Label; applied: boolean }> {
    return await pb.send('/api/labels/apply', {
      method: 'POST',
      body: { content: contentId, name },
    })
  }

  /**
   * Removes this user's application of a label.
   *
   * Plain CRUD under contents_labels.deleteRule, which permits the applier or an
   * admin — so a 403 here means the label was applied by someone else.
   */
  async function removeLabel(contentId: string, labelId: string): Promise<void> {
    const join = await pb
      .collection('contents_labels')
      .getFirstListItem(pb.filter('content={:c} && label={:l}', { c: contentId, l: labelId }), {
        requestKey: null,
      })
    await pb.collection('contents_labels').delete(join.id, { requestKey: null })
  }

  /**
   * Join rows for one content, so the UI knows which labels this user may remove.
   *
   * `user` is recorded for moderation, not ownership — anyone can apply a label,
   * but only the applier (or an admin) can take it off again.
   */
  async function joinsFor(contentId: string): Promise<LabelJoin[]> {
    try {
      return await pb.collection('contents_labels').getFullList<LabelJoin>({
        filter: pb.filter('content={:id}', { id: contentId }),
        expand: 'label',
        requestKey: null,
      })
    } catch {
      return []
    }
  }

  /** Whether the signed-in user (or an admin) can remove a given application. */
  function canRemove(join: LabelJoin | undefined): boolean {
    if (!join) return false
    if (authStore.isAdmin) return true
    return join.user === authStore.user?.id
  }

  return { isSearching, searchLabels, applyLabel, removeLabel, joinsFor, canRemove }
}
