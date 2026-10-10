import type { FetchVariation } from '~/composables/useFetchItems'
import type { PageState } from '~/types/listing'
import { computed, onActivated, onDeactivated, onMounted, ref, watch } from 'vue'
import { queryKey } from '~/utils/filterSupport'

export type ListingViewMode = 'grouped' | 'ungrouped'

/**
 * Owns the shared mechanics of a paginated, filterable content listing page:
 * fetch wiring, responsive masonry columns, page-change + filter-apply
 * handlers (with URL `?page=` sync), the initial load sequence, and the
 * settings/route watchers. Pages built on this shrink to markup + page-specific
 * bits (title, extra buttons).
 */
export function useContentListing(
  variation: FetchVariation,
  opts: {
    /**
     * Awaited before the first fetch, for state a variation's `baseFilter`
     * depends on (starred idols, for instance) — cheaper than loading it on
     * every listing page.
     */
    beforeLoad?: () => Promise<void>
    /**
     * Turns on the grouped/ungrouped toggle. `variation` stays the ungrouped
     * (per-content) list; this is the grouped (per-set) one.
     *
     * Two independent fetchers rather than one that swaps collection: the two
     * page over different collections with different totals, so they each need
     * their own current page. Carrying page 4 of a content list into a two-page
     * set list would land on an empty page.
     */
    groupedVariation?: FetchVariation
    /** localStorage key the chosen mode persists under. Ignored without groupedVariation. */
    viewModeKey?: string
    /** Mode before anything is stored. Grouped, as on /home. */
    defaultViewMode?: ListingViewMode
    /**
     * Called when the URL query empties while the page stays mounted — the
     * logo's "start over" on /home. Passing it also opts into the reset+refetch
     * that has to follow: the filter store is already cleared by then, so
     * without a refetch the old results just sit there.
     */
    onQueryCleared?: () => void
  } = {},
) {
  const route = useRoute()
  const router = useRouter()
  const filtersStore = useFiltersStore()
  const referenceStore = useReferenceStore()
  const settingsStore = useSettingsStore()
  const toast = useToast()

  const ungrouped = useFetchItems(variation)
  const grouped = opts.groupedVariation ? useFetchItems(opts.groupedVariation) : null

  /**
   * The mode the user actually chose, from storage.
   *
   * Only toggleViewMode writes that key, so this is the one value that is
   * always a deliberate choice — every other write to `viewMode` is a
   * session-only force (see honourLikeRanking).
   */
  function readStoredViewMode(): ListingViewMode {
    const fallback = opts.defaultViewMode ?? 'grouped'
    if (!opts.viewModeKey || !import.meta.client) return fallback
    const stored = localStorage.getItem(opts.viewModeKey)
    return stored === 'grouped' || stored === 'ungrouped' ? stored : fallback
  }

  const viewMode = ref<ListingViewMode>(opts.defaultViewMode ?? 'grouped')
  if (grouped) viewMode.value = readStoredViewMode()

  const isGrouped = computed(() => !!grouped && viewMode.value === 'grouped')
  const active = computed(() => (isGrouped.value && grouped ? grouped : ungrouped))

  const items = computed(() => active.value.items.value)
  const itemsTotal = computed(() => active.value.itemsTotal.value)
  const itemsCurrentPage = computed(() => active.value.itemsCurrentPage.value)
  const isLoading = computed(() => active.value.isLoading.value)
  const error = computed(() => active.value.error.value)

  /** Both of these act on whichever mode is live, so callers never pick. */
  function setPage(page: number) {
    active.value.itemsCurrentPage.value = page
  }
  async function fetchItems(page: number) {
    await active.value.fetchItems(page)
  }

  /**
   * Refetch the page currently on screen.
   *
   * For changes made from inside a card that alter the record itself — an admin
   * edit or delete — where the listing has to catch up but the reader should not
   * be thrown back to page 1.
   */
  async function refresh() {
    await fetchItems(itemsCurrentPage.value)
  }

  // A rejected filter used to be invisible: PocketBase 400s, the previous items
  // stay, and the page looks frozen. Toast once per failure so a bad clause is
  // reported rather than guessed at.
  watch(error, (err) => {
    if (!err) return
    toast.add({
      title: "Couldn't load posts",
      description: 'Try changing your filters.',
      color: 'error',
      duration: 4000,
    })
  })
  const { colCount } = useResponsiveColumns()
  const { columns } = useMasonry(items, colCount)

  const pageSize = computed(() => Number(settingsStore.settings.contentCount))
  const firstItemIndex = computed(() => (itemsCurrentPage.value - 1) * pageSize.value)

  async function changePage(e: PageState) {
    const newPage = e.page + 1
    const query = { ...route.query, page: String(newPage) }
    syncedQuery = queryKey(query)
    void router.replace({ query })
    setPage(newPage)
    await fetchItems(newPage)
    window.scrollTo(0, 0)
  }

  /**
   * Move to the ungrouped list when the active sort is a like ranking.
   *
   * That ranking is per-content: `likes` lives on `contents` and there is no
   * set-level equivalent to sort by (buildPbFilter spells out why). So rather
   * than serve a set list in recency order while the control says Most Liked,
   * show the list that can actually answer it — the same move the home page's
   * Top Posts row already makes, for the same reason.
   *
   * A direct `viewMode` write, so it follows the filter for this session without
   * overwriting the stored view preference. Called on the initial load too,
   * since the sort is persisted and arrives before any apply.
   */
  function honourLikeRanking() {
    if (grouped && isGrouped.value && filtersStore.filters.sort?.value === 'liked') {
      viewMode.value = 'ungrouped'
    }
  }

  /**
   * The query the items on screen were fetched for.
   *
   * The URL is the filter state (see utils/filterSupport), so every way the
   * query can change — a link, back/forward, keep-alive reactivation, this
   * page's own apply — funnels through syncFromRoute, and this is how it tells a
   * change it has to act on from one it caused itself. Compared by queryKey so
   * an equal query in a different order is not a change.
   */
  let syncedQuery: string | null = null

  /**
   * Make the store and the items say what the URL says.
   *
   * `?filter=<id>` is a saved filter's share link: the saved definition is
   * fetched and applied, and the URL is then rewritten to the expanded query so
   * that everything downstream — chips, nav links carrying the filters, back —
   * sees the same shape as a hand-built filter.
   */
  async function syncFromRoute() {
    if (route.query.filter) {
      const applied = await filtersStore.applySharedFilter(String(route.query.filter))
      if (applied) {
        const expanded = Object.fromEntries(new URLSearchParams(filtersStore.queryParams))
        syncedQuery = queryKey(expanded)
        void router.replace({ query: expanded })
      } else {
        filtersStore.applyQueryFilters(route.query)
        syncedQuery = queryKey(route.query)
      }
    } else {
      filtersStore.applyQueryFilters(route.query)
      syncedQuery = queryKey(route.query)
    }

    // After the filters are in place, since a URL-supplied sort is what decides this.
    honourLikeRanking()

    const page = Number.parseInt(route.query.page as string) || 1
    setPage(page)
    await fetchItems(page)

    // Labels restored from `?label=` are bare slugs; resolve their display names
    // after the fetch, since the filter clause matches on slug and doesn't wait.
    void filtersStore.hydrateLabelNames()
  }

  async function onFiltersSettingsApply() {
    honourLikeRanking()
    const query = Object.fromEntries(new URLSearchParams(filtersStore.queryParams))
    syncedQuery = queryKey(query)
    // push, not replace: applying a filter is a step the back button undoes,
    // which is what "restore filters on back/forward" means in practice.
    void router.push({ query })
    setPage(1)
    // The route path doesn't change, so the router keeps the scroll position —
    // and a chip clicked at the bottom of page 3 landed the new page 1 with its
    // first rows out of view. Before the fetch, not after like changePage, so
    // the spinner is what's on screen while the new items load.
    window.scrollTo(0, 0)
    await fetchItems(1)
    toast.add({
      title: 'Filters applied',
      color: 'success',
      duration: 1000,
    })
  }

  async function loadInitial() {
    // Everything before the fetch is best-effort, and has to be: `isLoading`
    // starts true and only fetchItems clears it, so anything that throws up
    // here leaves the page on a spinner that never resolves. That is exactly
    // what a rejected ensureLoaded() did to /uploaders/<name> on a cold load.
    //
    // Failing here degrades the filter UI (empty dropdowns, an unrestored
    // shared filter) — console-only, matching how storeReference already
    // handles a reference collection it couldn't read. The content itself is
    // not the filter bar's hostage.
    try {
      await referenceStore.ensureLoaded()
      if (opts.beforeLoad) await opts.beforeLoad()
    } catch (err) {
      console.error(`[useContentListing:${variation}] setup before the first fetch failed:`, err)
    }
    await syncFromRoute()
  }

  onMounted(loadInitial)

  // ─── KeepAlive ───────────────────────────────────────────────────────────────
  // Listing pages are kept alive (see their definePageMeta) so that back from a
  // /single/ page is instant, with the scroll position intact, instead of a
  // remount that refetches everything behind a spinner. Two things follow.
  //
  // A cached page is still mounted, so its watchers still run. `useRoute()`
  // returns the GLOBAL current route, which keeps changing after this page is
  // navigated away from — and the query watcher below would read "the query
  // emptied" on every hop to a query-less page and reset a listing nobody is
  // looking at. So every watcher checks both that this instance is active and
  // that the route is still this page's own path; the path check holds however
  // Vue happens to order the deactivation hook against the watcher flush.
  //
  // And a settings change made while this page was cached has to apply when
  // it comes back, so it is remembered rather than dropped.
  const ownPath = route.path
  const isActive = ref(true)
  let refetchOnActivate = false

  onDeactivated(() => {
    isActive.value = false
  })
  onActivated(() => {
    isActive.value = true
    // Fires on the first mount too, straight after onMounted — while loadInitial
    // is still awaiting the reference data. Nothing has been synced yet, and
    // loadInitial is about to; starting a second fetch here was a flash of "No
    // results" as the SDK cancelled one of the pair.
    if (syncedQuery === null) return
    // Back from /single/ lands here with the same query: nothing to do, which
    // is the point of keep-alive. A nav link or a back/forward that arrives
    // with a different query has to be honoured — the store may still hold
    // another page's filters, and the items are that other query's.
    if (queryKey(route.query) !== syncedQuery) {
      refetchOnActivate = false
      void syncFromRoute()
      return
    }
    if (refetchOnActivate) {
      refetchOnActivate = false
      setPage(1)
      void fetchItems(1)
    }
  })

  watch(
    () => settingsStore.settingsAppliedAt,
    () => {
      if (!isActive.value) {
        refetchOnActivate = true
        return
      }
      void onFiltersSettingsApply()
    },
  )

  // Every query change on this page that this page didn't make itself: the
  // back and forward buttons, the logo's reset, a link to the same path with
  // other filters. Each history entry describes a state, and this restores it.
  watch(
    () => route.query,
    async (newQuery, oldQuery) => {
      if (!isActive.value || route.path !== ownPath) return
      if (queryKey(newQuery) === syncedQuery) return
      // Query emptied while already on this page — see opts.onQueryCleared.
      if (
        opts.onQueryCleared &&
        Object.keys(newQuery).length === 0 &&
        Object.keys(oldQuery).length > 0
      ) {
        opts.onQueryCleared()
      }
      await syncFromRoute()
    },
    { deep: true },
  )

  function restoreStoredViewMode() {
    if (!grouped) return
    viewMode.value = readStoredViewMode()
  }

  async function toggleViewMode() {
    if (!grouped) return
    viewMode.value = isGrouped.value ? 'ungrouped' : 'grouped'
    if (opts.viewModeKey && import.meta.client) {
      localStorage.setItem(opts.viewModeKey, viewMode.value)
    }
    // Drop `?page`: the modes page over different collections, so page 4 of one
    // is meaningless as page 4 of the other. setPage/fetchItems below already
    // address the newly-active fetcher.
    setPage(1)
    const { page: _page, ...query } = route.query
    syncedQuery = queryKey(query)
    void router.replace({ query })
    await fetchItems(1)
    window.scrollTo(0, 0)
  }

  return {
    isGrouped,
    /**
     * Writable on purpose, but a direct write is SESSION-ONLY — nothing is
     * persisted and nothing refetches. That is exactly what the Top Posts row
     * needs (force ungrouped while open, apply separately); a deliberate mode
     * change goes through toggleViewMode, and undoing a force goes through
     * restoreStoredViewMode.
     */
    viewMode,
    /**
     * Hand the view mode back to the stored preference.
     *
     * For callers that force a mode for a while and then need to give it up.
     * Reads STORAGE rather than a value captured at force time, which is the
     * bug this replaced: the home page remembered `viewMode` when Top Posts was
     * opened, but honourLikeRanking may already have forced it to ungrouped —
     * a persisted `sort=liked` does that on the very first load, before the row
     * is even open. The captured "previous" mode was then itself the forced one,
     * so closing Top Posts restored ungrouped over a stored preference of
     * grouped, and nothing short of the explicit toggle got it back.
     */
    restoreStoredViewMode,
    toggleViewMode,
    items,
    itemsTotal,
    itemsCurrentPage,
    isLoading,
    error,
    columns,
    firstItemIndex,
    pageSize,
    fetchItems,
    refresh,
    changePage,
    onFiltersSettingsApply,
    /** Everything the current filters match, on every page — see useFetchItems. */
    fetchAllMatching: () => active.value.fetchAllMatching(),
  }
}
