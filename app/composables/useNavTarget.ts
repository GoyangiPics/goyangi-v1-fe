import type { RouteLocationRaw } from 'vue-router'
import { carryQuery } from '~/utils/filterSupport'

/**
 * Builds the route for an in-app link so the active filters travel with it —
 * to a page that consumes them, and nowhere else. See utils/filterSupport.
 *
 * One place rather than a `query: route.query` sprinkled on individual links,
 * which is how the avatar menu used to do it for two of its entries and none of
 * the others.
 */
export function useNavTarget() {
  const filtersStore = useFiltersStore()

  function to(path: string): RouteLocationRaw {
    return { path, query: carryQuery(filtersStore.queryParams, path) }
  }

  return { to }
}
