import PocketBase from 'pocketbase'
import { isGatewayStatus, isNetworkError } from '~/utils/backendStatus'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const pb = new PocketBase(config.public.baseUrl)

  // Outage detection is browser-only. An SSR page rendered while the backend is
  // down shows its own empty state, and the startup check below swaps it for
  // the maintenance screen as soon as it reaches the browser.
  if (import.meta.client) {
    const { check } = useBackendStatus()

    // A request that fails like an outage only asks for a health check; the
    // check decides. afterSend sees every HTTP response, including a proxy's
    // 502; a fetch that never got a response only surfaces through the wrapper.
    pb.afterSend = (response, data) => {
      if (isGatewayStatus(response.status)) void check()
      return data
    }
    pb.beforeSend = (url, options) => {
      const send = options.fetch ?? fetch
      options.fetch = (input, init) =>
        send(input, init).catch((error: unknown) => {
          if (isNetworkError(error, init?.signal)) void check()
          throw error
        })
      return { url, options }
    }

    // Also check once at startup, without waiting on it. A backend that hangs
    // rather than refusing would otherwise leave every page on its spinner.
    void check()
  }

  return {
    provide: { pb },
  }
})
