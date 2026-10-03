/**
 * Telling "the backend is down" apart from an ordinary failed request, so the
 * app can swap to the maintenance screen instead of spinning or erroring out.
 *
 * A request only ever raises the suspicion; pingBackend is what confirms it.
 * One dropped request on a flaky connection shouldn't blank the whole app.
 */

/**
 * Statuses that mean the API itself didn't answer: a proxy in front of it did.
 * 502–504 from any reverse proxy, 520–530 from Cloudflare (origin unreachable,
 * timed out, tunnel down). A 500 is PocketBase answering badly, not absent.
 */
export function isGatewayStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504 || (status >= 520 && status <= 530)
}

/**
 * fetch rejects with a TypeError when there was no usable response at all:
 * connection refused, DNS failure, or a proxy error page without CORS headers.
 * Aborts are excluded — the PocketBase SDK cancels duplicate requests itself,
 * and navigating away aborts in-flight ones.
 */
export function isNetworkError(error: unknown, signal?: AbortSignal | null): boolean {
  if (signal?.aborted) return false
  return error instanceof TypeError
}

/** PocketBase's /api/health answers 200 whenever the server is up. */
export async function pingBackend(
  baseUrl: string,
  { timeoutMs = 8000, fetchImpl = fetch }: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<boolean> {
  const url = new URL('api/health', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
  try {
    const response = await fetchImpl(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
    return response.ok
  } catch {
    // Includes the timeout: a backend that hangs is as down as one that refuses.
    return false
  }
}
