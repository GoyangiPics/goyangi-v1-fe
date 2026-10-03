import type { CollectionsItem } from '~/types/appTypes'
import { ref } from 'vue'

/**
 * Creating a `contents_collections` record for the signed-in user.
 *
 * Extracted from QuickCollectionModal, which held the app's only
 * `contents_collections.create` call — so "create a collection" was reachable
 * only by right-clicking a piece of content.
 *
 * Throws on failure rather than toasting, so callers can decide: the quick modal
 * keeps its own inline messaging, while the standalone dialog reports differently.
 */
export function useCreateCollection() {
  const pb = usePocketBase()
  const authStore = useAuthStore()

  const isCreating = ref(false)

  async function createCollection(title: string, isPublic: boolean): Promise<CollectionsItem> {
    const userId = authStore.user?.id
    if (!userId) throw new Error('Not authenticated')

    isCreating.value = true
    try {
      return await pb.collection('contents_collections').create<CollectionsItem>({
        title: title.trim(),
        user: userId,
        isPublic,
      })
    } finally {
      isCreating.value = false
    }
  }

  return { isCreating, createCollection }
}
