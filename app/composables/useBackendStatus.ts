import { pingBackend } from '~/utils/backendStatus'

// One check in flight at a time: a page firing ten requests at a dead backend
// raises ten suspicions, and they should share a single /api/health ping.
let pending: Promise<boolean> | null = null

/**
 * Whether the backend is reachable. app.vue swaps the whole app for
 * BackendMaintenance while `isDown` is true. The PocketBase plugin calls
 * `check()` whenever a request fails in a way that looks like an outage.
 */
export function useBackendStatus() {
  const isDown = useState('backend-down', () => false)
  const config = useRuntimeConfig()
  const nuxtApp = useNuxtApp()

  function check(): Promise<boolean> {
    pending ??= pingBackend(config.public.baseUrl)
      .then(async (up) => {
        // Not mid-hydration: swapping out a server-rendered page before its
        // Suspense resolves leaves the app hydrating forever, and head updates
        // (the tab title) stay paused with it.
        if (!up && nuxtApp.isHydrating) {
          await new Promise<void>((resolve) =>
            nuxtApp.hooks.hookOnce('app:suspense:resolve', () => resolve()),
          )
        }
        isDown.value = !up
        return up
      })
      .finally(() => {
        pending = null
      })
    return pending
  }

  return { isDown, check }
}
