import { onMounted, ref } from 'vue'
import { isNewSince } from '~/utils/lastVisit'

const LAST_VISIT_KEY = 'goyangi:lastVisit'
const BASELINE_KEY = 'goyangi:visitBaseline'

/** Resolved once per page load; see useLastVisit. `undefined` = not yet read. */
let baseline: number | null | undefined

/**
 * When this browser last visited, for marking what's new since.
 *
 * Two stores, because "last visit" has to stand still while it's being used:
 * every visit stamps `lastVisit` with now (localStorage, so it outlives the
 * tab), but the baseline the page marks against is the value from BEFORE this
 * tab's stamp, pinned in sessionStorage. So the badges survive a reload and
 * moving around the site, and reset only on the next separate visit.
 *
 * Per browser rather than per account: no schema and no write on every visit,
 * at the cost of a second device starting from its own history.
 *
 * Null on a first visit (nothing to compare against) and wherever storage is
 * unavailable — then nothing is marked new, which is the safe failure.
 */
function readBaseline(): number | null {
  try {
    const pinned = sessionStorage.getItem(BASELINE_KEY)
    if (pinned !== null) return pinned === '' ? null : Number(pinned) || null

    const previous = localStorage.getItem(LAST_VISIT_KEY)
    sessionStorage.setItem(BASELINE_KEY, previous ?? '')
    localStorage.setItem(LAST_VISIT_KEY, String(Date.now()))
    return previous ? Number(previous) || null : null
  } catch {
    return null
  }
}

/**
 * Read on mount, not in setup: the pages using this are server-rendered, and
 * the server has no storage — marking items during setup would render them
 * differently on each side and fail hydration.
 */
export function useLastVisit() {
  /** Epoch ms of the previous visit, or null. */
  const since = ref<number | null>(null)

  onMounted(() => {
    if (baseline === undefined) baseline = readBaseline()
    since.value = baseline
  })

  return {
    since,
    isNew: (item: { created?: string | null }) => isNewSince(item.created, since.value),
  }
}
