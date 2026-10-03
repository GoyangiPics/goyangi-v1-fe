import { ref } from 'vue'

export interface MergeResult {
  target: string
  moved: number
  deleted: string[]
}

/**
 * Merging several sets into one.
 *
 * The one operation here that genuinely has to be a backend endpoint rather than
 * client-side CRUD: `contents.set` is `cascadeDelete`, so a source set must have
 * its children reassigned BEFORE it is deleted, atomically. Getting that order
 * wrong destroys the clips and their R2 objects. The endpoint does the whole thing
 * in one transaction with a count guard immediately before each delete.
 *
 * Isolated here so the call site is one function, as with the other route-backed
 * features.
 */
export function useMergeSets() {
  const pb = usePocketBase()

  const isMerging = ref(false)

  async function mergeSets(targetId: string, sourceIds: string[]): Promise<MergeResult> {
    isMerging.value = true
    try {
      return await pb.send('/api/admin/sets/merge', {
        method: 'POST',
        body: { target: targetId, sources: sourceIds },
      })
    } finally {
      isMerging.value = false
    }
  }

  return { isMerging, mergeSets }
}
