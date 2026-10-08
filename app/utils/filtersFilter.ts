import type { Filters, MostLikedModes } from '~/types/typesFilters'
import { calculateDateRange, formatPbDate } from '~/utils/dateRanges'

interface BuildPbFilterOpts {
  /** Prefix every field reference with `content.` (used when filtering on relation collections). */
  useContentPrefix?: boolean
  /** Resolve fields against `contents_via_set.*` where the set itself lacks them. */
  remapForSets?: boolean
  /**
   * Resolve every content field against `contents_via_collections.*`. A
   * collection carries none of them itself, so unlike a set there is nothing to
   * leave un-remapped; a clause against `idol` on `contents_collections` was a
   * 400 and an empty page.
   */
  remapForCollections?: boolean
  /** Title search term (free-text). */
  searchValue?: string | null
  /** Active "most liked" preset, if any — used to freshen the date window. */
  mostLikedMode?: MostLikedModes | null
  /**
   * Whether the target collection can be sorted by like count — in practice,
   * whether it IS `contents`.
   *
   * `likes` is a field on `contents` and on nothing else: `contents_sets` and
   * `contents_collections` both lack it, and PocketBase answers 400 for a sort
   * on a column that isn't there. Defaults to false so a collection has to
   * declare it can take the ranking; the failure mode of forgetting is then a
   * list in recency order rather than a page that cannot load at all.
   */
  canRankByLikes?: boolean
}

/**
 * How a field's selected items turn into a filter clause.
 *
 * - `relationId`   — relation matched by record id
 * - `optionValue`  — select/option field matched by literal value
 * - `slug`         — relation matched by slug, for labels, which arrive from the
 *                    URL as bare slugs with no id known yet
 */
type MatchMode = 'relationId' | 'optionValue' | 'slug'

interface FieldSpec {
  key: keyof Filters
  /** Path on a `contents` record. */
  path: string
  /**
   * Path when `remapForSets` is on. Omitted when the SET carries the field
   * itself — idol/group/uploader/origin all exist on `contents_sets`, so
   * remapping them would filter by the children instead of the set.
   */
  setPath?: string
  /** Path when `remapForCollections` is on. Every content field has one. */
  collectionPath: string
  mode: MatchMode
}

/**
 * Every filterable field in one table.
 *
 * Replaces a hardcoded key list plus a separate remap Set, which meant adding a
 * field touched two places that had to agree — and silently produced a filter
 * against a non-existent column when they didn't (see `allSets`, which filtered
 * `tag` on `contents_sets`).
 */
const VIA_COLLECTION = 'contents_via_collections.'

const FIELD_SPECS: readonly FieldSpec[] = [
  { key: 'idol', path: 'idol', collectionPath: `${VIA_COLLECTION}idol`, mode: 'relationId' },
  { key: 'group', path: 'group', collectionPath: `${VIA_COLLECTION}group`, mode: 'relationId' },
  {
    key: 'uploader',
    path: 'uploader',
    collectionPath: `${VIA_COLLECTION}uploader`,
    mode: 'relationId',
  },
  {
    key: 'tag',
    path: 'tag',
    setPath: 'contents_via_set.tag',
    collectionPath: `${VIA_COLLECTION}tag`,
    mode: 'relationId',
  },
  {
    key: 'filetype',
    path: 'filetype',
    setPath: 'contents_via_set.filetype',
    collectionPath: `${VIA_COLLECTION}filetype`,
    mode: 'optionValue',
  },
  // Sets carry their own origin, so NO setPath: a Discord-ingested set does not
  // contain direct-upload children, and asking the children would be a
  // different question from the one the filter poses.
  { key: 'origin', path: 'origin', collectionPath: `${VIA_COLLECTION}origin`, mode: 'optionValue' },
  {
    key: 'label',
    path: 'labels',
    setPath: 'contents_via_set.labels',
    collectionPath: `${VIA_COLLECTION}labels`,
    mode: 'slug',
  },
]

/**
 * Quote a user-supplied literal for a PocketBase filter string.
 *
 * `searchValue` used to be interpolated raw, so a single `"` in the search box
 * produced a malformed filter, PocketBase answered 400, and `useFetchItems`
 * swallowed it — the page simply appeared to freeze. Label slugs arrive from the
 * URL, which makes the same path reachable without typing anything.
 */
export function pbQuote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * Build a PocketBase filter string + sort key from a typed `Filters` object.
 *
 * Replaces the legacy `buildFilterQuery` that read from `localStorage`
 * directly. The single source of truth for filter state is now the Pinia
 * `filtersStore`; this function is a pure transformer.
 */
export function buildPbFilter(
  filters: Filters,
  opts: BuildPbFilterOpts = {},
): { filter: string; sort: string } {
  const {
    useContentPrefix = false,
    remapForSets = false,
    remapForCollections = false,
    searchValue,
    mostLikedMode,
    canRankByLikes = false,
  } = opts
  const prefix = useContentPrefix ? 'content.' : ''
  const queries: string[] = []

  // The field "Actual" means. A collection has no date of its own and its
  // contents' dates are many, so collections listings stay on `created`.
  // Top Posts is a window of recent uploads, so it never follows the toggle.
  const actualField = remapForCollections ? null : `${prefix}date`
  const byActual = filters.dateMode?.value === 'actual' && !!actualField && !mostLikedMode
  const rangeField = byActual ? actualField : `${prefix}created`

  // Date window — `mostLikedMode` overrides any saved `filters.date` since
  // the preset is meant to track "the last N days from now" on every fetch.
  if (mostLikedMode) {
    const { startDate, endDate } = calculateDateRange(mostLikedMode)
    queries.push(
      `${prefix}created>=${pbQuote(formatPbDate(startDate))}&&${prefix}created<=${pbQuote(formatPbDate(endDate))}`,
    )
  } else if (filters.date.length === 2 && filters.date[0] && filters.date[1]) {
    const startDate = new Date(filters.date[0])
    const endDate = new Date(filters.date[1])
    endDate.setHours(23, 59, 59, 999)
    queries.push(
      `${rangeField}>=${pbQuote(formatPbDate(startDate))}&&${rangeField}<=${pbQuote(formatPbDate(endDate))}`,
    )
  }

  if (searchValue && searchValue.length > 0) queries.push(`${prefix}title~${pbQuote(searchValue)}`)

  const buildClause = (
    spec: FieldSpec,
    items: Array<{ id?: string; value?: string; option?: string; slug?: string }> | undefined,
  ) => {
    // `items` can be undefined: `filters` is persisted to localStorage, so a
    // returning session predates any newly added key until the store's
    // afterHydrate merge runs.
    if (!items || items.length === 0) return null

    const field =
      remapForSets && spec.setPath
        ? spec.setPath
        : remapForCollections
          ? spec.collectionPath
          : spec.path
    const path = `${prefix}${field}`
    const parts = items
      .map((item) => {
        switch (spec.mode) {
          case 'relationId':
            return item.id ? `${path}.id?=${pbQuote(item.id)}` : null
          case 'optionValue':
            return item.value ? `${path}=${pbQuote(item.value)}` : null
          case 'slug':
            return item.slug ? `${path}.slug?=${pbQuote(item.slug)}` : null
          default:
            return null
        }
      })
      .filter((p) => p !== null)
    return parts.length > 0 ? `(${parts.join('||')})` : null
  }

  for (const spec of FIELD_SPECS) {
    const clause = buildClause(spec, filters[spec.key] as any)
    if (clause) queries.push(clause)
  }

  /**
   * The like ranking, and why most listings cannot have it.
   *
   * Only `contents` carries `likes` (see canRankByLikes). Unlike the filter
   * clauses there is nothing to remap to for the others: PocketBase cannot sort
   * by a back-relation aggregate, so no server-side "sets by total child likes"
   * exists to fall back to. Those listings sort by recency instead.
   *
   * Ungated, this was a hard lockout: `sort=-likes:length` against
   * contents_sets or contents_collections 400'd the whole page, and because
   * `filters` is persisted the rejected sort came back on every reload — with
   * the dialog's Reset unable to clear it. Callers that CAN offer the ranking
   * switch to their per-content list — see useContentListing.honourLikeRanking.
   */
  const wantsLikeRanking = filters.sort?.value === 'liked' || !!mostLikedMode
  // Newest/Oldest go by the same date the range does. By upload it is the
  // listing's own `created` — on the likes list that is when the like was made,
  // as it always has been.
  const direction = filters.sort?.value === 'oldest' ? '' : '-'
  const chronological = `${direction}${byActual ? actualField : 'created'}`
  const sort = wantsLikeRanking && canRankByLikes ? '-likes:length' : chronological

  return {
    filter: queries.join('&&'),
    sort,
  }
}

/** Compose two PocketBase filter strings with `&&`, handling empties gracefully. */
export function combinePbFilters(...parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => !!p && p.length > 0).join('&&')
}
