import { computed, ref } from 'vue'

/** How a star row is keyed locally, so its record id can be found for deletion. */
function starKey(kind: 'idol' | 'group', id: string) {
  return `${kind}:${id}`
}

/**
 * Starred idols and groups, backing the /me/feed scope.
 *
 * A store of its own rather than part of storeReference, which is documented as
 * "fetched once per session and rarely changes" and gated behind a one-shot
 * isLoaded. Stars mutate on every click and want optimistic updates. (savedFilters
 * living in that store is the counter-example — it needed a manual
 * fetchSavedFilters escape hatch precisely because it doesn't fit either.)
 *
 * One `users_stars` row per star, so toggling is a create or a delete rather than
 * rewriting an array — which is also why the row ids are tracked here.
 */
export const useStarsStore = defineStore(
  'starsStore',
  () => {
    const pb = usePocketBase()
    const authStore = useAuthStore()

    const idolIds = ref<string[]>([])
    const groupIds = ref<string[]>([])
    /** starKey → users_stars record id, needed to delete a star. */
    const rowIds = ref<Record<string, string>>({})
    /** Whose stars these are, so a different account can't inherit them. */
    const ownerId = ref<string | null>(null)
    const isLoaded = ref(false)

    const hasAny = computed(() => idolIds.value.length > 0 || groupIds.value.length > 0)

    function isIdolStarred(id: string) {
      return idolIds.value.includes(id)
    }

    function isGroupStarred(id: string) {
      return groupIds.value.includes(id)
    }

    function clear() {
      idolIds.value = []
      groupIds.value = []
      rowIds.value = {}
      ownerId.value = null
      isLoaded.value = false
    }

    /** Idempotent; a no-op when signed out. */
    async function ensureLoaded() {
      const userId = authStore.user?.id
      if (!userId) {
        clear()
        return
      }
      if (isLoaded.value && ownerId.value === userId) return

      try {
        const rows = await pb.collection('users_stars').getFullList({
          filter: pb.filter('user={:user}', { user: userId }),
          requestKey: null,
        })
        const idols: string[] = []
        const groups: string[] = []
        const ids: Record<string, string> = {}
        for (const row of rows) {
          const idol = row.idol as string
          const group = row.group as string
          if (idol) {
            idols.push(idol)
            ids[starKey('idol', idol)] = row.id
          } else if (group) {
            groups.push(group)
            ids[starKey('group', group)] = row.id
          }
        }
        idolIds.value = idols
        groupIds.value = groups
        rowIds.value = ids
        ownerId.value = userId
        isLoaded.value = true
      } catch (error) {
        console.error('Could not load stars:', error)
      }
    }

    /**
     * Optimistic toggle, rolled back on failure.
     *
     * Group and idol stars are independent: starring a group means "everything
     * from this group", starring an idol means that idol. Nothing collapses one
     * into the other — see DialogManageStars for why that matters.
     */
    async function toggle(kind: 'idol' | 'group', id: string) {
      const userId = authStore.user?.id
      if (!userId) return

      const list = kind === 'idol' ? idolIds : groupIds
      const key = starKey(kind, id)
      const wasStarred = list.value.includes(id)

      if (wasStarred) {
        const rowId = rowIds.value[key]
        list.value = list.value.filter((v) => v !== id)
        if (!rowId) return
        try {
          await pb.collection('users_stars').delete(rowId, { requestKey: null })
          const next = { ...rowIds.value }
          delete next[key]
          rowIds.value = next
        } catch {
          list.value = [...list.value, id]
        }
      } else {
        list.value = [...list.value, id]
        try {
          const row = await pb
            .collection('users_stars')
            .create({ user: userId, [kind]: id }, { requestKey: null })
          rowIds.value = { ...rowIds.value, [key]: row.id }
        } catch {
          list.value = list.value.filter((v) => v !== id)
        }
      }
    }

    const toggleIdol = (id: string) => toggle('idol', id)
    const toggleGroup = (id: string) => toggle('group', id)

    return {
      idolIds,
      groupIds,
      rowIds,
      ownerId,
      isLoaded,
      hasAny,
      isIdolStarred,
      isGroupStarred,
      ensureLoaded,
      toggleIdol,
      toggleGroup,
      clear,
    }
  },
  {
    persist: {
      // Persisted so /me/feed's first paint doesn't wait a round-trip.
      pick: ['idolIds', 'groupIds', 'rowIds', 'ownerId'],
      afterHydrate: (ctx) => {
        // Without this, a shared browser would show one account's feed scope to
        // whoever signs in next. Same defensive shape as storeSettings'.
        const store = ctx.store as any
        const pb = usePocketBase()
        const currentUser = pb.authStore.record?.id ?? null
        if (store.ownerId !== currentUser) {
          store.idolIds = []
          store.groupIds = []
          store.rowIds = {}
          store.ownerId = null
        }
        // Always refetch: the persisted copy is a paint optimisation, not a cache.
        store.isLoaded = false
      },
    },
  },
)
