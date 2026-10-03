import type { Group, Idol, SavedFilter, Tag, Uploader } from '~/types/appTypes'
import { ref } from 'vue'

/**
 * Reference data — collections that are fetched once per session and rarely
 * change (idols, groups, tags, uploaders, plus the user's saved filters).
 * Lookups against this data drive the filter UI.
 */
export const useReferenceStore = defineStore('referenceStore', () => {
  const pb = usePocketBase()

  const idols = ref<Idol[]>([])
  const groups = ref<Group[]>([])
  const tags = ref<Tag[]>([])
  const uploaders = ref<Uploader[]>([])
  const savedFilters = ref<SavedFilter[]>([])
  const isLoaded = ref(false)

  /**
   * `requestKey: null` on every request below, and it is load-bearing.
   *
   * The SDK auto-cancels a pending request when a new one arrives under the
   * same key, and the default key is method+path with the query string
   * ignored — so any page that queries one of these collections for its own
   * purposes (an uploader profile lookup, say) would abort the session load
   * that happened to still be in flight. For the ones behind fetchByName that
   * surfaces as permanently empty filter dropdowns; for the two raw calls it
   * rejects fetchAll outright. Neither is ever what you want from a one-shot
   * session load, so these opt out of auto-cancellation entirely.
   */
  async function fetchByName<T>(collection: string): Promise<T[]> {
    try {
      return await pb.collection(collection).getFullList<T>({ sort: 'name', requestKey: null })
    } catch (error) {
      console.error(`Error fetching records from ${collection}:`, error)
      return []
    }
  }

  async function fetchAll() {
    const userId = pb.authStore.record?.id
    const [idolsData, groupsData, tagsData, uploadersData, savedFiltersData] = await Promise.all([
      fetchByName<Idol>('groups_idols'),
      fetchByName<Group>('groups'),
      fetchByName<Tag>('tags'),
      pb
        .collection('uploaders')
        .getFullList<Uploader>({ sort: 'name', expand: 'user', requestKey: null }),
      userId
        ? pb.collection('users_filters').getFullList<SavedFilter>({
            sort: 'name',
            filter: pb.filter('user = {:userId}', { userId }),
            requestKey: null,
          })
        : Promise.resolve([]),
    ])
    idols.value = idolsData
    groups.value = groupsData
    tags.value = tagsData
    uploaders.value = uploadersData
    savedFilters.value = savedFiltersData
    isLoaded.value = true
  }

  /** In-flight fetchAll, so concurrent callers share one load. See ensureLoaded. */
  let loading: Promise<void> | null = null

  /** Fetch once. Idempotent for repeated calls within a session. */
  async function ensureLoaded() {
    if (isLoaded.value) return
    // Two components mounting on the same tick both see isLoaded false, so
    // without this they each start their own fetchAll — duplicate requests for
    // data that never changes mid-session, and (before requestKey: null above)
    // the second one's calls would auto-cancel the first's and reject a load
    // that was about to succeed. Cleared on settle so a failed load can retry.
    loading ??= fetchAll().finally(() => {
      loading = null
    })
    await loading
  }

  async function fetchSavedFilters() {
    try {
      const userId = pb.authStore.record?.id
      if (!userId) {
        savedFilters.value = []
        return
      }
      savedFilters.value = await pb.collection('users_filters').getFullList<SavedFilter>({
        sort: 'name',
        filter: pb.filter('user = {:userId}', { userId }),
        requestKey: null,
      })
    } catch (error) {
      console.error('Error fetching saved filters:', error)
    }
  }

  return {
    idols,
    groups,
    tags,
    uploaders,
    savedFilters,
    isLoaded,
    fetchAll,
    ensureLoaded,
    fetchSavedFilters,
  }
})
