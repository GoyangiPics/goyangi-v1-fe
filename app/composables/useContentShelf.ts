import type { Ref } from 'vue'
import type { ContentsItem } from '~/types/appTypes'
import { onMounted, ref, watch } from 'vue'
import { CONTENT_EXPAND } from '~/composables/useFetchItems'

export interface ShelfQuery {
  /**
   * Filters tried in order until one returns at least `minItems` — for a
   * "trending this week" row that should widen to the month on a quiet week
   * rather than show two cards.
   */
  filters: string[]
  sort?: string
  limit: number
  /** Defaults to `limit`. */
  minItems?: number
}

/**
 * One short, fixed list of posts for a home-page row or tile grid.
 *
 * Unlike useFetchItems this has no pages, no URL and no user filters: a home
 * row is a curated slice, and its "see all" link hands off to the full feed.
 *
 * `query` returns null until what it depends on is ready (tags, stars), and
 * false for a row that can't have anything in it (a topic whose tag doesn't
 * exist yet). The row reloads whenever the query it describes changes.
 *
 * Each shelf passes its own `requestKey`. A page runs several of these at once
 * against the same collection, and the SDK's default key (method + path) would
 * have each new request cancel the one before it.
 */
export function useContentShelf(key: string, query: () => ShelfQuery | null | false) {
  const pb = usePocketBase()

  const items: Ref<ContentsItem[]> = ref([])
  const isLoading = ref(true)

  let generation = 0

  async function load(q: ShelfQuery) {
    const mine = ++generation
    isLoading.value = true
    try {
      let found: ContentsItem[] = []
      for (const filter of q.filters) {
        const page = await pb.collection('contents').getList<ContentsItem>(1, q.limit, {
          filter,
          sort: q.sort ?? '-created',
          expand: CONTENT_EXPAND,
          skipTotal: true,
          requestKey: `shelf:${key}`,
        })
        if (mine !== generation) return
        found = page.items
        if (found.length >= (q.minItems ?? q.limit)) break
      }
      items.value = found
    } catch (err) {
      if (mine !== generation || (err as any)?.isAbort) return
      console.error(`[useContentShelf:${key}] fetch error:`, err)
      items.value = []
    } finally {
      if (mine === generation) isLoading.value = false
    }
  }

  watch(
    () => {
      const q = query()
      return q ? JSON.stringify(q) : q
    },
    (serialized) => {
      if (serialized === false) {
        generation++
        items.value = []
        isLoading.value = false
      } else if (serialized) {
        void load(JSON.parse(serialized) as ShelfQuery)
      }
    },
    { immediate: true },
  )

  return { items, isLoading }
}

/**
 * Reference data and stars, loaded once for a home page. `ready` gates every
 * shelf query: tag ids and starred idols are part of the filters.
 */
export function useHomeReady() {
  const referenceStore = useReferenceStore()
  const starsStore = useStarsStore()
  const ready = ref(false)

  onMounted(async () => {
    try {
      await Promise.all([referenceStore.ensureLoaded(), starsStore.ensureLoaded()])
    } catch (err) {
      console.error('[useHomeReady] setup failed:', err)
    }
    ready.value = true
  })

  return { ready, referenceStore, starsStore }
}

/**
 * Where a card's chip click goes on a home page.
 *
 * A card applies its idol/tag/uploader chip to the filter store and emits
 * `filtersApply` for its listing to refetch. A home page has no listing to
 * refetch, so the click carries the filter over to the full feed instead.
 */
export function useFeedHandoff() {
  const filtersStore = useFiltersStore()
  return function openInFeed() {
    void navigateTo({
      path: '/',
      query: Object.fromEntries(new URLSearchParams(filtersStore.queryParams)),
    })
  }
}
