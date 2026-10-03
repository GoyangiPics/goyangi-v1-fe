import type { CollectionsItem } from '~/types/appTypes'
import { ref } from 'vue'

/**
 * The signed-in user's own collections.
 *
 * `getFullList` rather than a page: this was `getList(1, 50)` in
 * QuickCollectionModal, which silently truncated at 50 with no pagination and no
 * indication that anything was missing — you simply couldn't reach your older
 * collections. The table is per-user and small, so loading all of it is the same
 * call pattern storeReference uses for idols and groups.
 *
 * `user` is a MULTI relation on contents_collections (maxSelect 999), so `?~` is
 * the correct operator and a co-owned collection appears for every owner.
 */
export function useMyCollections() {
  const pb = usePocketBase()
  const authStore = useAuthStore()

  const collections = ref<CollectionsItem[]>([])
  const isLoading = ref(false)
  const error = ref<unknown>(null)

  async function fetchCollections(): Promise<void> {
    const userId = authStore.user?.id
    if (!userId) {
      collections.value = []
      return
    }

    isLoading.value = true
    error.value = null
    try {
      collections.value = await pb.collection('contents_collections').getFullList<CollectionsItem>({
        filter: pb.filter('user?~{:user}', { user: userId }),
        sort: '-created',
      })
    } catch (err) {
      error.value = err
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Splice a just-created collection in without a refetch, so it's immediately
   * selectable. Sorted newest-first, so it goes on the front.
   */
  function addLocal(collection: CollectionsItem): void {
    if (collections.value.some((c) => c.id === collection.id)) return
    collections.value = [collection, ...collections.value]
  }

  return { collections, isLoading, error, fetchCollections, addLocal }
}
