import type { MaybeRefOrGetter } from 'vue'
import { ref, toValue } from 'vue'

/** URL segment per target — matches the backend's hardcoded table map. */
const COLLECTION_BY_KIND = {
  content: 'contents',
  set: 'contents_sets',
} as const

/**
 * Already-counted keys for this page session.
 *
 * Module-scoped, so it survives component remounts. This is frontend hygiene
 * against Vue's dev double-invoke, HMR, and re-entering the same route
 * client-side — NOT server-side dedupe. The backend counts every request by
 * decision, so a hard reload still counts again.
 */
const fired = new Set<string>()

/**
 * Increments and reads a record's view count.
 *
 * The increment goes through a custom route because nothing else works:
 * `contents.updateRule` blocks `views` for non-owners *and* requires auth, while
 * both detail pages are public. A client read-modify-write would also lose
 * concurrent increments — the endpoint does it in one atomic statement.
 *
 * Call `register` from `onMounted`. That is the whole SSR story: `onMounted` never
 * runs on the server, so a crawler fetching the page — and both `/single/**` and
 * `/set/**` ARE server-rendered — can't inflate the count. Never move this into
 * `useAsyncData` or the SEO fetch: those run server-side for every social-card
 * unfurl, and their payload is transferred rather than re-run on the client, so it
 * would count bots and miss real visitors.
 */
export function useViewCounter(
  kind: keyof typeof COLLECTION_BY_KIND,
  id: MaybeRefOrGetter<string>,
) {
  const pb = usePocketBase()

  const views = ref<number | null>(null)

  /**
   * @param initial the count already on the fetched record, shown until the
   * server returns the incremented value — the SSR'd HTML necessarily carries
   * the pre-increment number.
   */
  async function register(initial?: number) {
    if (typeof initial === 'number') views.value = initial

    if (import.meta.server) return

    const resolvedId = toValue(id)
    if (!resolvedId) return

    const key = `${kind}:${resolvedId}`
    if (fired.has(key)) return
    fired.add(key)

    try {
      const res = await pb.send<{ views?: number }>(
        `/api/views/${COLLECTION_BY_KIND[kind]}/${encodeURIComponent(resolvedId)}`,
        { method: 'POST' },
      )
      if (typeof res?.views === 'number') views.value = res.views
    } catch {
      // A view count is never worth a toast. Leave whatever `initial` gave us.
    }
  }

  return { views, register }
}
