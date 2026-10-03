import type { LocationQuery } from 'vue-router'
import type { SavedFilter } from '~/types/appTypes'
import type { Filters } from '~/types/typesFilters'
import { MostLikedModes } from '~/types/typesFilters'
import { computed, ref } from 'vue'
import { contentTypes, relabelFiletypes } from '~/utils/contentTypes'
import { calculateDateRange } from '~/utils/dateRanges'
import { serializeFiltersToQuery } from '~/utils/filtersQuery'
import { resolveIdolToken } from '~/utils/idolSelection'

const sortType = [
  { value: 'recent', option: 'Recent' },
  { value: 'liked', option: 'Most Liked' },
]

const dateMode = [
  { value: 'created', option: 'Created' },
  { value: 'actual', option: 'Actual' },
]

// contentTypes lives in utils/contentTypes.ts so the option → filetype mapping is
// testable: "Gifs" pointed at `video` for a long time, and nothing could have
// caught it here.

/** Provenance. Neither selected = all. Values match the backend `origin` field. */
const originTypes = [
  { option: 'Direct', value: 'direct' },
  { option: 'Imgur', value: 'imgur' },
  { option: 'Discord', value: 'discord' },
]

/** Splits a `?key=a,b` (or repeated-key) query param into its values. */
function queryValues(param: LocationQuery[string]): string[] {
  return Array.isArray(param) ? param.filter((v): v is string => !!v) : String(param).split(',')
}

/**
 * Exported because DialogBaseFilters used to re-declare this literal twice (its
 * local default and its reset), so every new field was a three-place edit that
 * had to agree.
 */
export function makeDefaultFilters(): Filters {
  return {
    idol: [],
    group: [],
    tag: [],
    uploader: [],
    filetype: [],
    origin: [],
    label: [],
    date: [],
    dateMode: dateMode[0] ?? null,
    sort: sortType[0] ?? null,
  }
}

export const useFiltersStore = defineStore(
  'filtersStore',
  () => {
    const pb = usePocketBase()
    const referenceStore = useReferenceStore()

    // The store used to persist under this key. Nothing reads it any more (see
    // the note at the bottom), so drop it rather than leave every returning
    // visitor carrying a stale copy of their last filters forever.
    if (import.meta.client) {
      try {
        localStorage.removeItem('filtersStore')
      } catch {
        // Storage unavailable — nothing to clean.
      }
    }

    // State
    const filters = ref<Filters>(makeDefaultFilters())
    const mostLikedMode = ref<MostLikedModes | null>(null)
    const searchValue = ref('')

    // Getters
    const isFilterSet = computed(() =>
      Object.values(filters.value).some((v) => Array.isArray(v) && v.length > 0),
    )

    const queryParams = computed(() =>
      serializeFiltersToQuery(
        filters.value,
        referenceStore.idols,
        referenceStore.groups,
        sortType[0]?.value,
        searchValue.value,
        mostLikedMode.value,
      ),
    )

    // Actions
    function setMostLikedMode(mode: MostLikedModes) {
      mostLikedMode.value = mode
      const { startDate, endDate } = calculateDateRange(mode)
      filters.value.date = [startDate, endDate]
      filters.value.sort = sortType[1] ?? null
    }

    async function applySharedFilter(id: string): Promise<boolean> {
      try {
        const record = await pb.collection('users_filters').getOne<SavedFilter>(id)
        if (!record?.filters) return false
        const parsed =
          typeof record.filters === 'string' ? JSON.parse(record.filters) : record.filters
        if (parsed.date?.length) parsed.date = parsed.date.map((d: string) => new Date(d))
        // A saved filter carries option labels from whenever it was saved.
        if (parsed.filetype?.length) parsed.filetype = relabelFiletypes(parsed.filetype)
        // Backfill keys added since it was saved (origin, label), or `.length`
        // on them throws on the first render. This used to be the persisted
        // store's afterHydrate job as well; the saved blob is the last place a
        // stale shape can come from.
        filters.value = { ...makeDefaultFilters(), ...parsed }
        mostLikedMode.value = null
        searchValue.value = ''
        return true
      } catch {
        return false
      }
    }

    /**
     * Make the store say exactly what `query` says — no more, no less.
     *
     * The URL is the filter state (see utils/filterSupport). So this resets
     * first, unconditionally: an empty query means no filters, and a query with
     * only `?tag=x` means only that tag. It used to reset only when the query
     * carried something, which is how last session's idol filter leaked into a
     * page reached through a bare nav link, and how back/forward replayed the
     * store instead of the state each history entry actually described.
     */
    function applyQueryFilters(query: LocationQuery) {
      filters.value = makeDefaultFilters()
      mostLikedMode.value = null
      searchValue.value = ''

      // The Top Posts window sets its own date range and sort; an explicit
      // `sort`/`date` further down still wins, as it does in the dialog.
      if (query.top) {
        const mode = String(Array.isArray(query.top) ? query.top[0] : query.top) as MostLikedModes
        if (Object.values(MostLikedModes).includes(mode)) setMostLikedMode(mode)
      }

      if (query.search) {
        searchValue.value = Array.isArray(query.search)
          ? String(query.search[0] ?? '')
          : String(query.search)
      }

      const matchByName = <T extends { name: string }>(
        param: LocationQuery[string],
        list: T[],
      ): T[] =>
        queryValues(param)
          .map((name) => list.find((item) => item.name === name))
          .filter((item) => item !== undefined)

      // Idols go through resolveIdolToken rather than matchByName: several idols
      // share a name, so a bare `?idol=Chaewon` can only ever resolve to the
      // first of them. serializeFiltersToQuery emits `Chaewon~LE SSERAFIM` for
      // those, and this is the reader for it.
      if (query.idol) {
        filters.value.idol = queryValues(query.idol)
          .map((token) => resolveIdolToken(token, referenceStore.idols, referenceStore.groups))
          .filter((idol) => idol !== undefined)
      }
      if (query.group) {
        // A group in the URL expands to all of its idols.
        for (const groupName of queryValues(query.group)) {
          const grp = referenceStore.groups.find((g) => g.name === groupName)
          if (grp) {
            const groupIdols = referenceStore.idols.filter((i) => i.group === grp.id)
            for (const gi of groupIdols) {
              if (!filters.value.idol.some((fi) => fi.id === gi.id)) filters.value.idol.push(gi)
            }
          }
        }
      }
      if (query.tag) filters.value.tag = matchByName(query.tag, referenceStore.tags)
      if (query.uploader)
        filters.value.uploader = matchByName(query.uploader, referenceStore.uploaders)
      if (query.filetype) {
        filters.value.filetype = queryValues(query.filetype)
          .map((type) => contentTypes.find((ct) => ct.value === type))
          .filter((ct) => ct !== undefined)
      }
      if (query.origin) {
        filters.value.origin = queryValues(query.origin)
          .map((v) => originTypes.find((o) => o.value === v))
          .filter((o) => o !== undefined)
      }
      if (query.label) {
        // Name doubles as the slug until hydrateLabelNames resolves it — the
        // filter clause matches on slug, so this is already usable.
        filters.value.label = queryValues(query.label).map((slug) => ({ name: slug, slug }))
      }
      if (query.sort) {
        filters.value.sort = sortType.find((s) => s.value === query.sort) ?? sortType[0] ?? null
      }
      if (query.date) {
        const parts = Array.isArray(query.date)
          ? (query.date[0] as string).split(',')
          : (query.date as string).split(',')
        const start = parts[0] ? new Date(parts[0]) : null
        const end = parts[1] ? new Date(parts[1]) : start
        filters.value.date = [start, end].filter(
          (d) => d instanceof Date && !Number.isNaN(d.getTime()),
        ) as Date[]
      }
    }

    /**
     * Fill in `id`/`name` for labels that came from the URL as bare slugs, so
     * chips read "Cute Fancam" rather than "cute-fancam".
     *
     * Non-fatal by design: the filter clause matches on slug, so a failure here
     * costs nothing but the display name.
     */
    async function hydrateLabelNames() {
      const missing = filters.value.label.filter((l) => !l.id)
      if (missing.length === 0) return
      try {
        const clause = missing.map((l) => pb.filter('slug={:slug}', { slug: l.slug })).join('||')
        const found = await pb.collection('labels').getList(1, 50, { filter: clause })
        for (const label of filters.value.label) {
          const match = found.items.find((r: any) => r.slug === label.slug)
          if (match) {
            label.id = match.id
            label.name = match.name
          }
        }
      } catch {
        // Slugs remain as the display name.
      }
    }

    function reset() {
      filters.value = makeDefaultFilters()
      mostLikedMode.value = null
      searchValue.value = ''
    }

    return {
      // state
      filters,
      mostLikedMode,
      searchValue,
      // option lists
      sortType,
      dateMode,
      contentTypes,
      originTypes,
      // getters
      isFilterSet,
      queryParams,
      // actions
      setMostLikedMode,
      applySharedFilter,
      applyQueryFilters,
      hydrateLabelNames,
      reset,
    }
  },
  // Deliberately NOT persisted. Filters used to survive in localStorage, which
  // made the store a second source of truth beside the URL — and the two
  // disagreed whenever a page was reached through a bare link. The URL is the
  // only state now (see utils/filterSupport): a reload, a back, a bookmark and
  // a shared link all say what is applied, and a fresh visit to / is unfiltered.
  // Saved filters live in `users_filters` on the server and are unaffected.
)
