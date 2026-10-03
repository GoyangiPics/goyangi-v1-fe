import { ref } from 'vue'

export interface MergeUploadersResult {
  target: string
  name: string
  movedContent: number
  movedSets: number
  deleted: string[]
  /** Retired names folded into the target's aliases, so the bot resolves them onto it. */
  aliasesAdded: string[]
  aliases: string
}

/**
 * Folding duplicate uploader profiles into one.
 *
 * The duplicates are structural rather than accidental: the Discord bot mints an
 * uploader from the poster's Discord username, the site mints one from the name
 * the account chose, and `uploaders.name` is not unique — so one person using
 * both doors becomes two records. Only the site record carries `user`, which is
 * what every ownership check reads, so their Discord-ingested content is neither
 * theirs to edit nor listed in their own uploads.
 *
 * A backend endpoint rather than client-side CRUD, for the reasons useMergeSets
 * gives plus one of its own: `contents.uploader` and `contents_sets.uploader`
 * have to be repointed BEFORE the source is deleted, atomically, and the
 * multi-valued set relation needs the id swapped inside its array. The endpoint
 * does the whole thing in one transaction with a count guard before each delete.
 */
export function useMergeUploaders() {
  const pb = usePocketBase()

  const isMerging = ref(false)

  async function mergeUploaders(
    targetId: string,
    sourceIds: string[],
  ): Promise<MergeUploadersResult> {
    isMerging.value = true
    try {
      return await pb.send('/api/admin/uploaders/merge', {
        method: 'POST',
        body: { target: targetId, sources: sourceIds },
      })
    } finally {
      isMerging.value = false
    }
  }

  return { isMerging, mergeUploaders }
}
