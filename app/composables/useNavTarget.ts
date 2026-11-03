import type { RouteLocationRaw } from 'vue-router'
import { carryQuery } from '~/utils/filterSupport'

/**
 * Builds the route for an in-app link with the filters it should carry. See
 * utils/filterSupport.
 *
 * One place rather than a `query: route.query` sprinkled on individual links,
 * which is how the avatar menu used to do it for two of its entries and none of
 * the others.
 */
export function useNavTarget() {
  const filtersStore = useFiltersStore()

  /** A nav link: the destination's own last filters, never this page's. */
  function to(path: string): RouteLocationRaw {
    return { path, query: filtersStore.queryFor(path) }
  }

  /**
   * The filters active right now, taken to `path` — for a chip clicked on a
   * page with no listing of its own, whose whole point is "show me this there".
   */
  function withActive(path: string): RouteLocationRaw {
    return { path, query: carryQuery(filtersStore.queryParams, path) }
  }

  return { to, withActive }
}
