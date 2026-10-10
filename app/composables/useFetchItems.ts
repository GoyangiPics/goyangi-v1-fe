import type { Ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { ref } from 'vue'
import { buildPbFilter, combinePbFilters, pbQuote } from '~/utils/filtersFilter'

export type FetchVariation =
  | 'allContents'
  | 'likedContents'
  | 'allSets'
  | 'allSetsUnified'
  | 'allCollections'
  | 'setContents'
  | 'collectionContents'
  | 'savedCollections'
  | 'uploaderContents'
  | 'myContents'
  | 'mySets'
  | 'labelContents'
  | 'starredContents'
  | 'starredSetsUnified'

interface VariationCtx {
  route: RouteLocationNormalizedLoaded
  userId: string | undefined
  /**
   * Starred ids, passed in rather than read from the store inside a baseFilter.
   * These closures run inside an async fetchItems, where Pinia's active instance
   * isn't guaranteed — so the store is read in useFetchItems' setup instead.
   */
  starIdolIds: string[]
  starGroupIds: string[]
}

interface VariationConfig {
  collection: 'contents' | 'contents_sets' | 'contents_collections' | 'users_likes'
  expand: string
  /** Returns the fixed filter slice that scopes the query (e.g. set id, user id, sticker exclusion). */
  baseFilter?: (ctx: VariationCtx) => string
  /** Whether to apply the user's active filters (idol/group/tag/etc.) and search value. */
  applyUserFilters: boolean
  /** If set, overrides the sort from buildPbFilter (used by chronological lists). */
  defaultSort?: string
  /** `buildPbFilter` knobs. */
  useContentPrefix?: boolean
  remapForSets?: boolean
  remapForCollections?: boolean
  /**
   * Turns a fetched record into the item the page renders. For a variation that
   * queries a join collection and hands back the content it points at; null
   * drops the row (a like whose content is gone).
   */
  mapItem?: (record: any) => any
}

const CONTENT_EXPAND = 'idol,group,tag,labels,uploader,uploader.user,likes'
// The same expand, reached through a `users_likes` row's `content` relation.
const LIKED_CONTENT_EXPAND = [
  'content',
  ...CONTENT_EXPAND.split(',').map((f) => `content.${f}`),
].join(',')
// No `tag` here: `contents_sets` has no tag field, so expanding it was dead
// weight on every set query.
const SET_EXPAND = 'idol,group,uploader,uploader.user,contents_via_set'
// Every relation CardChips reads has to be listed at the child level too: these
// cards render a set's CHILD content, so a relation expanded only at the top
// level is a set's, not the item's. `contents_via_set.labels` was missing, which
// is why a label added on a home/feed card vanished on reload — the chip came from
// the in-place patch, and the reloaded record simply had no labels in its expand.
const UNIFIED_SET_EXPAND =
  'idol,group,uploader,uploader.user,contents_via_set,' +
  'contents_via_set.idol,contents_via_set.group,contents_via_set.tag,' +
  'contents_via_set.labels,contents_via_set.uploader,contents_via_set.uploader.user,' +
  'contents_via_set.likes'
const COLLECTION_EXPAND = 'user,contents_via_collections'

/**
 * The starred-idols/groups clause, shared by the two feed variations.
 *
 * `contents` and `contents_sets` both carry plain `idol`/`group` relations, so the
 * same paths work against either — the same reason those two filter keys need no
 * `setPath` in FIELD_SPECS.
 *
 * Returns null for "nothing starred" so each caller decides what that means.
 *
 * Caveat on the set flavour: a set's own idol/group is what's matched, and adding
 * to an existing set from the upload page doesn't union the new child's idol onto
 * the set. So a set can hold a starred idol's content without matching here. The
 * grouped idol filter on /home has the same blind spot; fixing it belongs on the
 * upload path, not in this clause.
 */
function starredScope({ starIdolIds, starGroupIds }: VariationCtx): string | null {
  const parts = [
    ...starIdolIds.map((id) => `idol.id?=${pbQuote(id)}`),
    ...starGroupIds.map((id) => `group.id?=${pbQuote(id)}`),
  ]
  return parts.length > 0 ? `(${parts.join('||')})` : null
}

const VARIATIONS: Record<FetchVariation, VariationConfig> = {
  allContents: {
    collection: 'contents',
    expand: CONTENT_EXPAND,
    baseFilter: () => 'filetype != "sticker"',
    applyUserFilters: true,
  },
  // Asked from the `users_likes` side, not `contents` filtered by `likes.user`.
  // `likes` is a multi-relation, which PocketBase stores as a JSON array per
  // row, so that filter unpacked the array of all ~19k contents and joined
  // each entry — no index can help inside JSON — and took 5–20 s per page.
  // `users_likes` has a unique index led by `user`, so this is a lookup: the
  // same 48 items and the same total in 0.2 s. `mapItem` hands the page the
  // content each like points at, so nothing downstream changes.
  //
  // Sorted by when the like was made rather than when the content was posted,
  // which is arguably what a "Saved" page should do anyway. Most Liked cannot
  // rank here (`likes:length` lives on contents; see canRankByLikes) and falls
  // to that recency — the same degradation the set and collection lists have.
  likedContents: {
    collection: 'users_likes',
    expand: LIKED_CONTENT_EXPAND,
    // pbQuote on every interpolation in these baseFilters — most of the values
    // are route params, and while API rules are the real access gate, a quote
    // in a crafted URL must not be able to rewrite the query.
    baseFilter: ({ userId }) =>
      combinePbFilters(
        userId ? `user=${pbQuote(userId)}` : 'id=""',
        'content.filetype != "sticker"',
      ),
    applyUserFilters: true,
    useContentPrefix: true,
    defaultSort: '-created',
    mapItem: (like) => like.expand?.content ?? null,
  },
  allSets: {
    collection: 'contents_sets',
    expand: SET_EXPAND,
    // Hide sets with no contents. `?!=` ("any related content exists") is the
    // emptiness check: a set with zero contents has no back-relation rows, so
    // nothing satisfies it and the set is excluded. Server-side so pagination
    // and totals stay correct.
    baseFilter: () => 'contents_via_set.id ?!= ""',
    applyUserFilters: true,
    defaultSort: '-created',
    // Was missing, so /sets was silently broken under a tag or filetype filter:
    // those resolved against `contents_sets`, which has neither field,
    // PocketBase rejected the whole filter, and the catch below left the
    // previous page's items on screen. allSetsUnified always had it, which is
    // why the home page worked and this page didn't.
    remapForSets: true,
  },
  allSetsUnified: {
    collection: 'contents_sets',
    expand: UNIFIED_SET_EXPAND,
    // The same emptiness check allSets carries, and for a sharper reason: this
    // is the home page's grouped view, and CardUnified renders nothing at all
    // for a set with no contents. So an empty set used to consume a slot in the
    // page of 24, count towards the "N sets" total, and leave a hole in the
    // masonry — a page that looked short for no visible reason.
    baseFilter: () => 'contents_via_set.id ?!= ""',
    applyUserFilters: true,
    defaultSort: '-created',
    remapForSets: true,
  },
  allCollections: {
    collection: 'contents_collections',
    expand: COLLECTION_EXPAND,
    // Public collections that actually contain something (see allSets note on
    // the `?!=` emptiness check).
    baseFilter: () => combinePbFilters('isPublic=true', 'contents_via_collections.id ?!= ""'),
    applyUserFilters: true,
    defaultSort: '-created',
    // A collection has no content fields of its own, so an idol filter carried
    // here from home used to be a clause against a missing column — a 400 and
    // an empty page. Resolved through the back-relation instead, like sets.
    remapForCollections: true,
  },
  setContents: {
    collection: 'contents',
    expand: CONTENT_EXPAND,
    baseFilter: ({ route }) => `set=${pbQuote(String(route.params.id))}`,
    applyUserFilters: false,
    defaultSort: '-created',
  },
  collectionContents: {
    collection: 'contents',
    expand: CONTENT_EXPAND,
    baseFilter: ({ route }) => `collections~${pbQuote(String(route.params.id))}`,
    applyUserFilters: true,
  },
  savedCollections: {
    collection: 'contents_collections',
    expand: COLLECTION_EXPAND,
    baseFilter: ({ userId }) => (userId ? `user?~${pbQuote(userId)}` : 'id=""'), // empty filter if no user
    applyUserFilters: true,
    defaultSort: '-created',
    remapForCollections: true,
  },
  uploaderContents: {
    collection: 'contents',
    expand: CONTENT_EXPAND,
    baseFilter: ({ route }) =>
      combinePbFilters(
        `uploader.name=${pbQuote(String(route.params.name))}`,
        'filetype != "sticker"',
      ),
    applyUserFilters: true,
  },
  myContents: {
    collection: 'contents',
    expand: CONTENT_EXPAND,
    baseFilter: ({ userId }) => (userId ? `uploader.user=${pbQuote(userId)}` : 'id=""'),
    applyUserFilters: true,
    defaultSort: '-created',
  },
  labelContents: {
    collection: 'contents',
    expand: CONTENT_EXPAND,
    // Matches on slug, so /labels/<slug> needs no id lookup before it can fetch.
    baseFilter: ({ route }) =>
      combinePbFilters(
        `labels.slug?=${pbQuote(String(route.params.slug))}`,
        'filetype != "sticker"',
      ),
    applyUserFilters: true,
  },
  starredContents: {
    collection: 'contents',
    expand: CONTENT_EXPAND,
    baseFilter: (ctx) => {
      const scope = starredScope(ctx)
      // No stars → show nothing, not the whole site. Same idiom as myContents
      // when signed out: an unscoped feed would look like the scope silently
      // failed rather than being empty.
      if (!scope) return 'id=""'
      return combinePbFilters(scope, 'filetype != "sticker"')
    },
    applyUserFilters: true,
    defaultSort: '-created',
  },
  starredSetsUnified: {
    collection: 'contents_sets',
    expand: UNIFIED_SET_EXPAND,
    baseFilter: (ctx) => {
      const scope = starredScope(ctx)
      if (!scope) return 'id=""'
      // Plus the emptiness check allSets uses — a grouped view of empty sets is
      // just blank cards.
      return combinePbFilters(scope, 'contents_via_set.id ?!= ""')
    },
    applyUserFilters: true,
    defaultSort: '-created',
    remapForSets: true,
  },
  mySets: {
    collection: 'contents_sets',
    expand: SET_EXPAND,
    // `?=` not `=`: contents_sets.uploader is a MULTI relation (sets accumulate
    // co-uploaders as people add to them), unlike contents.uploader which is
    // single-valued — so myContents' plain `=` would be wrong here.
    baseFilter: ({ userId }) => (userId ? `uploader.user?=${pbQuote(userId)}` : 'id=""'),
    applyUserFilters: true,
    defaultSort: '-created',
    remapForSets: true,
    // Deliberately NO emptiness filter, unlike allSets: this is a management
    // page, and an empty set is exactly the thing you come here to delete.
  },
}

export function useFetchItems(variation: FetchVariation) {
  const pb = usePocketBase()
  const route = useRoute()
  const filtersStore = useFiltersStore()
  const authStore = useAuthStore()
  const settingsStore = useSettingsStore()
  // Read here, in setup, for the reason given on VariationCtx.
  const starsStore = useStarsStore()

  const items: Ref<any[]> = ref([])
  const itemsTotal = ref(0)
  const itemsCurrentPage = ref(1)
  const isLoading = ref(true)
  /**
   * Last fetch error, or null.
   *
   * Exposed because a rejected filter used to be console-only: PocketBase 400s,
   * the catch logs, and the previous items stay on screen — so from the outside
   * "the page just didn't change". That failure mode hid the missing
   * `remapForSets` on /sets above, and every new filter clause can reproduce it.
   */
  const error = ref<unknown>(null)

  const config = VARIATIONS[variation]

  // Which fetch is the current one. Two can overlap — a query change while the
  // first is in flight — and the SDK auto-cancels the earlier request, but its
  // `finally` still ran, so the spinner went out while the real fetch was still
  // loading: with no items yet, that read as "No results" for a second. Only the
  // latest fetch gets to touch state; a superseded one leaves everything alone.
  let generation = 0

  /** The filter and sort the listing last fetched with. */
  let lastQuery: { sort: string; filter: string } | null = null

  async function fetchItems(page: number) {
    const mine = ++generation
    isLoading.value = true
    error.value = null
    try {
      const ctx: VariationCtx = {
        route,
        userId: authStore.user?.id,
        starIdolIds: starsStore.idolIds,
        starGroupIds: starsStore.groupIds,
      }

      const baseFilter = config.baseFilter?.(ctx) ?? ''

      let userFilter = ''
      let userSort: string | undefined
      if (config.applyUserFilters) {
        const built = buildPbFilter(filtersStore.filters, {
          useContentPrefix: config.useContentPrefix,
          remapForSets: config.remapForSets,
          remapForCollections: config.remapForCollections,
          searchValue: filtersStore.searchValue,
          mostLikedMode: filtersStore.mostLikedMode,
          // `likes` exists on `contents` alone; contents_sets and
          // contents_collections have no such field and PocketBase 400s a sort
          // against one that isn't there.
          canRankByLikes: config.collection === 'contents',
        })
        userFilter = built.filter
        userSort = built.sort
      }

      const filter = combinePbFilters(userFilter, baseFilter)
      // User sort wins when filters are applied — the sort dropdown on
      // sets/collections pages should affect results, not be silently
      // overridden by the variation's default.
      const sort = userSort ?? config.defaultSort ?? '-created'

      lastQuery = { sort, filter }
      const records = await pb
        .collection(config.collection)
        .getList(page, +settingsStore.settings.contentCount, {
          sort,
          filter,
          expand: config.expand,
        })

      if (mine !== generation) return
      items.value = config.mapItem
        ? records.items.map(config.mapItem).filter((item) => item !== null)
        : records.items
      itemsTotal.value = records.totalItems
    } catch (err) {
      if (mine !== generation) return
      // An aborted request is the SDK auto-cancelling a superseded fetch (a fast
      // page change, a filter re-apply). Not a failure, and surfacing it would
      // flash an error toast during normal navigation.
      if ((err as any)?.isAbort) return
      error.value = err
      console.error(`[useFetchItems:${variation}] fetch error:`, err)
    } finally {
      if (mine === generation) isLoading.value = false
    }
  }

  /**
   * Every item the last fetch matched, across all pages — for "select all"
   * before a bulk action. Same filter, sort, expand and item mapping as the
   * listing, so what gets selected is exactly what the pages would show.
   */
  async function fetchAllMatching() {
    if (!lastQuery) return []
    const records = await pb.collection(config.collection).getFullList({
      ...lastQuery,
      expand: config.expand,
      requestKey: null,
    })
    return config.mapItem ? records.map(config.mapItem).filter((item) => item !== null) : records
  }

  return {
    items,
    itemsTotal,
    itemsCurrentPage,
    isLoading,
    error,
    fetchItems,
    fetchAllMatching,
  }
}
