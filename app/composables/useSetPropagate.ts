import { ref } from 'vue'

/** Fields a set can push down onto its children. Mirrors the backend allowlist. */
export type PropagatableField = 'title' | 'idol' | 'group' | 'date' | 'uploader'

export interface PropagateResult {
  updated: number
  fields: string[]
}

/**
 * Pushing a set's metadata down onto its child contents.
 *
 * A backend endpoint rather than a client-side batch, because a batch cannot
 * work here: `contents.updateRule` requires `uploader.user = @request.auth.id` to
 * change title/idol/group/date, and a set legitimately holds clips from several
 * uploaders (uploads.vue appends co-uploaders when you add to an existing set).
 * So a browser batch 403s on every clip the editor didn't upload — and
 * PocketBase batches are atomic, meaning one rejection fails all of them and the
 * user gets nothing.
 *
 * The route call is isolated here so it can be swapped for plain CRUD if
 * `contents.updateRule` is ever loosened to admit set co-uploaders, which would
 * be the more PocketBase-native fix.
 */
export function useSetPropagate() {
  const pb = usePocketBase()

  const isRunning = ref(false)

  /** How many clips a propagation would touch, for the confirm step. */
  async function countChildren(setId: string): Promise<number> {
    const res = await pb.collection('contents').getList(1, 1, {
      filter: pb.filter('set={:id}', { id: setId }),
      fields: 'id',
      requestKey: null,
    })
    return res.totalItems
  }

  async function propagate(setId: string, fields: PropagatableField[]): Promise<PropagateResult> {
    isRunning.value = true
    try {
      return await pb.send(`/api/sets/${encodeURIComponent(setId)}/propagate`, {
        method: 'POST',
        body: { fields },
      })
    } finally {
      isRunning.value = false
    }
  }

  return { isRunning, countChildren, propagate }
}
