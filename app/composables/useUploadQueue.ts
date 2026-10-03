import { onScopeDispose, ref, shallowRef } from 'vue'

/**
 * Polls the depth of the backend's encode queue.
 *
 * The backend transcodes one file at a time (MAX_PROCESS_JOBS, default 1) with
 * every other job parked behind it, and nothing on screen said so: an uploader
 * adding 10 gifs while 20 of someone else's were already encoding just saw their
 * own items sit at "Generating preview..." for twenty minutes with no
 * explanation. `GET /api/queue` publishes the counters that make that visible —
 * see hooks/queue_api.go in the backend for why it's a route and not a
 * collection.
 *
 * The snapshot shape and everything derived from it live in ~/utils/uploadQueue.
 */

/** Default cadence. The queue moves on encode-completion timescales (seconds to minutes). */
const DEFAULT_INTERVAL_MS = 5000

/**
 * Stop retrying after this many consecutive failures.
 *
 * The endpoint is new, so a frontend deploy can outrun the backend one and every
 * poll would 404. Rather than logging a failure every 5s forever, give up and let
 * `isAvailable` hide the UI — a queue hint is not worth a console full of errors.
 */
const MAX_FAILURES = 3

export function useUploadQueue() {
  const pb = usePocketBase()

  const snapshot = shallowRef<UploadQueueSnapshot | null>(null)
  /** False once the endpoint has proven unreachable; the UI hides itself. */
  const isAvailable = ref(true)

  let timer: ReturnType<typeof setInterval> | null = null
  let inFlight = false
  let failures = 0

  async function refresh(): Promise<void> {
    // A slow response must not queue up more requests behind it — the poll is
    // advisory, so skipping a tick is always better than piling on.
    if (inFlight || !isAvailable.value) return
    inFlight = true
    try {
      // requestKey: null — the SDK auto-cancels same-key requests and this path
      // is fixed, so a manual refresh landing on top of a tick would abort one of
      // them. Same trap useLikeApi documents.
      const result = await pb.send('/api/queue', { method: 'GET', requestKey: null })
      snapshot.value = result as UploadQueueSnapshot
      failures = 0
    } catch {
      // Deliberately silent: this is a hint, and the page it lives on has real
      // work to report failures about.
      if (++failures >= MAX_FAILURES) {
        isAvailable.value = false
        snapshot.value = null
        stop()
      }
    } finally {
      inFlight = false
    }
  }

  function start(intervalMs: number = DEFAULT_INTERVAL_MS): void {
    if (timer !== null || !isAvailable.value) return
    void refresh()
    timer = setInterval(() => {
      // A backgrounded tab tells us nothing about what the uploader is looking
      // at, and its numbers would be stale by the time they returned — so skip
      // the request but keep the timer, and the next visible tick catches up.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void refresh()
    }, intervalMs)
  }

  function stop(): void {
    if (timer === null) return
    clearInterval(timer)
    timer = null
  }

  onScopeDispose(stop)

  return { snapshot, isAvailable, refresh, start, stop }
}
