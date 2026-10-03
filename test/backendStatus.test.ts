import { describe, expect, it } from 'vitest'
import { isGatewayStatus, isNetworkError, pingBackend } from '~/utils/backendStatus'

describe('isGatewayStatus', () => {
  it('flags proxy and Cloudflare origin errors', () => {
    for (const status of [502, 503, 504, 520, 521, 522, 523, 524, 530]) {
      expect(isGatewayStatus(status)).toBe(true)
    }
  })

  it('leaves answers from PocketBase itself alone', () => {
    for (const status of [200, 400, 401, 403, 404, 429, 500, 501, 505, 519, 531]) {
      expect(isGatewayStatus(status)).toBe(false)
    }
  })
})

describe('isNetworkError', () => {
  it('treats a fetch TypeError as no response', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
  })

  it('ignores aborts, which the SDK and navigation cause on purpose', () => {
    const controller = new AbortController()
    controller.abort()
    expect(isNetworkError(new TypeError('Failed to fetch'), controller.signal)).toBe(false)
    expect(isNetworkError(new DOMException('Aborted', 'AbortError'))).toBe(false)
  })
})

// A fetch that answers with `init` (or throws it), recording what was requested.
function fakeFetch(init: ResponseInit | Error) {
  const requested: string[] = []
  const fetchImpl = (async (url: URL) => {
    requested.push(url.toString())
    if (init instanceof Error) throw init
    return new Response('{}', init)
  }) as unknown as typeof fetch
  return { fetchImpl, requested }
}

describe('pingBackend', () => {
  it('is up on a 200 from /api/health', async () => {
    const { fetchImpl, requested } = fakeFetch({ status: 200 })
    expect(await pingBackend('https://api.goyangi.pics/', { fetchImpl })).toBe(true)
    expect(requested).toEqual(['https://api.goyangi.pics/api/health'])
  })

  it('adds the slash a base URL without one needs', async () => {
    const { fetchImpl, requested } = fakeFetch({ status: 200 })
    await pingBackend('http://127.0.0.1:8090', { fetchImpl })
    expect(requested).toEqual(['http://127.0.0.1:8090/api/health'])
  })

  it('is down on a gateway error or no response', async () => {
    expect(await pingBackend('https://x/', fakeFetch({ status: 502 }))).toBe(false)
    expect(await pingBackend('https://x/', fakeFetch(new TypeError('x')))).toBe(false)
  })
})
