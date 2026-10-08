import type { LocationQuery } from 'vue-router'

/**
 * Which pages consume the filter query, and how filters travel between them.
 *
 * The URL is the filter state. A listing derives its filters from its own
 * query on every visit — mount, keep-alive activation, back/forward, a link —
 * and an empty query means no filters. Nothing is remembered outside the URL,
 * so the browser's history is exactly the history of what was applied.
 *
 * That leaves in-app navigation to decide what a link carries. Clicking an idol
 * on home and hopping to Collections should still show that idol, so the nav
 * links carry the active query to any page that can consume it — and carry
 * nothing to a page that can't, rather than leaving parameters in the URL that
 * nothing applies. Before this, filters lived in a persisted store and leaked
 * into every page through the back door: arriving at /collections with an idol
 * filter meant a clause against a field the collection doesn't have, a 400 from
 * PocketBase, and an empty page with no visible reason.
 */

/** Every key the filter query can carry. `filter` is a saved-filter id, `top` the Top Posts window. */
export const FILTER_PARAMS = [
  'search',
  'idol',
  'group',
  'tag',
  'uploader',
  'filetype',
  'origin',
  'label',
  'sort',
  'datemode',
  'date',
  'top',
  'filter',
] as const

export type FilterParam = (typeof FILTER_PARAMS)[number]

/**
 * Pages that run their listing through the filter store, by path. Every one of
 * them accepts the whole query: the collection listings resolve content filters
 * through their `contents_via_*` back-relation (see filtersFilter), so there is
 * no page left that takes some parameters and not others. A per-path list
 * rather than a flag, so the day one appears it is a one-line change here.
 */
const PAGE_FILTERS: Record<string, readonly FilterParam[]> = {
  '/': FILTER_PARAMS,
  '/singles': FILTER_PARAMS,
  '/sets': FILTER_PARAMS,
  '/collections': FILTER_PARAMS,
  '/me/feed': FILTER_PARAMS,
  '/me/likes': FILTER_PARAMS,
  '/me/collections': FILTER_PARAMS,
  '/me/uploads': FILTER_PARAMS,
  '/me/sets': FILTER_PARAMS,
}

/** The filter parameters `path` consumes; empty for a page with no filterable listing. */
export function pageFilterParams(path: string): readonly FilterParam[] {
  return PAGE_FILTERS[path] ?? []
}

/** Whether a route query carries any filter parameter at all. */
export function hasFilterParams(query: LocationQuery): boolean {
  return FILTER_PARAMS.some((key) => query[key] !== undefined && query[key] !== '')
}

/**
 * The query a link to `path` should carry, given the active filter query string
 * (as the store serializes it). Only what the destination consumes; never
 * `page`, since page 4 of one listing is meaningless on another.
 */
export function carryQuery(activeQuery: string, path: string): Record<string, string> {
  const allowed = new Set<string>(pageFilterParams(path))
  const out: Record<string, string> = {}
  for (const [key, value] of new URLSearchParams(activeQuery)) {
    if (allowed.has(key) && value !== '') out[key] = value
  }
  return out
}

/**
 * A stable key for a route query, for telling "the query changed" from "the
 * route object was replaced with an equal one". Order-independent.
 */
export function queryKey(query: LocationQuery): string {
  const params = new URLSearchParams()
  for (const key of Object.keys(query).toSorted()) {
    const value = query[key]
    if (value === undefined || value === null) continue
    for (const v of Array.isArray(value) ? value : [value]) if (v !== null) params.append(key, v)
  }
  return params.toString()
}
