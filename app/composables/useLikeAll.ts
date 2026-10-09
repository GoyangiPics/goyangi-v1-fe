import type { ContentsItem } from '~/types/appTypes'
import { ref } from 'vue'

export interface LikeAllResult {
  liked: number
  /** Already liked by this user before we started. */
  skipped: number
  failed: number
}

/**
 * How many likes run at once.
 *
 * Kept low deliberately. A 200-item set is 400 requests, and PocketBase's
 * built-in rate limiter is a runtime setting we can't read from here — raise
 * this only after checking it in the admin UI.
 */
const LIKE_ALL_CONCURRENCY = 4

/** Same predicate useLikeItem syncs its own state from. */
function alreadyLiked(item: ContentsItem, userId: string): boolean {
  return !!item.expand?.likes?.some((l: any) => l.user === userId)
}

/**
 * Bulk "like everything in this set".
 *
 * The behaviour already existed, inline in set/[id].vue, where it was sequential,
 * limited to the current page, and carried its own copy of the like writes.
 */
export function useLikeAll() {
  const pb = usePocketBase()
  const authStore = useAuthStore()
  const toast = useToast()
  const { requireAuth } = useAuthGate()
  const { createLike } = useLikeApi()

  const isLikingAll = ref(false)
  const likedSoFar = ref(0)
  const likeAllTotal = ref(0)

  /**
   * Likes every item not already liked.
   *
   * Mutates each item's `expand.likes` in place so rendered cards update without
   * a refetch. Safe against CardUnified's frozen carousel order: `orderedIds`
   * only recomputes when the *set of ids* changes, so bulk liking can't re-rank
   * the list under the viewer.
   */
  async function likeAllItems(items: ContentsItem[]): Promise<LikeAllResult | null> {
    if (!requireAuth('like posts')) return null
    const userId = authStore.user?.id
    if (!userId || isLikingAll.value) return null

    const pending = items.filter((item) => !alreadyLiked(item, userId))
    const result: LikeAllResult = {
      liked: 0,
      skipped: items.length - pending.length,
      failed: 0,
    }

    if (pending.length === 0) {
      toast.add({
        title: 'Already liked',
        description: `You've already liked ${items.length === 1 ? 'this post' : `all ${items.length} posts`}.`,
        color: 'info',
        duration: 2000,
      })
      return result
    }

    isLikingAll.value = true
    likedSoFar.value = 0
    likeAllTotal.value = pending.length

    // duration: 0 disables the auto-close timer. It has to be repeated on every
    // update() — Nuxt UI's update sets duration from the toast's own value
    // unconditionally, so omitting it resurrects the timer mid-run.
    const progress = toast.add({
      title: 'Liking posts…',
      description: `0/${pending.length}`,
      color: 'info',
      duration: 0,
    })

    // Worker pool over a shared cursor, rather than chunked batches: a slow
    // request in one chunk would otherwise idle the rest.
    let cursor = 0
    async function worker() {
      while (cursor < pending.length) {
        const item = pending[cursor++]
        if (!item) continue
        try {
          const likeRecord = await createLike(userId!, item.id)
          if (!item.expand) item.expand = {} as any
          if (!item.expand!.likes) item.expand!.likes = []
          item.expand!.likes.push({ ...likeRecord } as any)
          result.liked++
        } catch (error) {
          result.failed++
          console.error('Error liking content:', item.id, error)
        }
        likedSoFar.value = result.liked + result.failed
        toast.update(progress.id, {
          description: `${likedSoFar.value}/${pending.length}`,
          duration: 0,
        })
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(LIKE_ALL_CONCURRENCY, pending.length) }, worker),
    )

    const parts: string[] = []
    if (result.skipped) parts.push(`${result.skipped} already liked`)
    if (result.failed) parts.push(`${result.failed} failed`)

    toast.update(progress.id, {
      title:
        result.liked === 0 && result.failed > 0
          ? "Couldn't like posts"
          : `Liked ${result.liked} post${result.liked === 1 ? '' : 's'}`,
      description: parts.length ? parts.join(' · ') : undefined,
      color: result.failed ? 'warning' : 'success',
      duration: 3000,
    })

    isLikingAll.value = false
    return result
  }

  /**
   * Likes an entire set or collection, fetching its contents first.
   *
   * Prefer likeAllItems when the caller already holds the items with `likes`
   * expanded (CardUnified does) — this costs an extra request.
   *
   * `opts.live` lets a caller hand in objects it has on screen. Without it the
   * in-place likes land on the private copies fetched here, so the very card the
   * action was triggered from kept a white heart and an unchanged count until a
   * refetch — the fetched record and the rendered one are different objects.
   */
  async function likeAllIn(
    target: { setId: string } | { collectionId: string },
    opts: { live?: ContentsItem[] } = {},
  ): Promise<LikeAllResult | null> {
    if (!requireAuth('like posts')) return null

    const filter =
      'setId' in target
        ? pb.filter('set={:id}', { id: target.setId })
        : pb.filter('collections~{:id}', { id: target.collectionId })

    try {
      const fetched = await pb.collection('contents').getFullList<ContentsItem>({
        filter,
        expand: 'likes',
        requestKey: null,
      })

      // Substitute the caller's rendered instances so the mutation is visible.
      // Only when the live object carries its own `likes` expand — otherwise the
      // fetched copy is the one that can answer "already liked?", and swapping it
      // out would re-like an item and leave a duplicate row. An empty array
      // counts as expanded.
      const live = new Map((opts.live ?? []).map((item) => [item.id, item]))
      const items = fetched.map((record) => {
        const rendered = live.get(record.id)
        return rendered?.expand?.likes ? rendered : record
      })

      if (items.length === 0) {
        toast.add({
          title: 'No posts to like',
          color: 'warning',
          duration: 2000,
        })
        return { liked: 0, skipped: 0, failed: 0 }
      }
      return await likeAllItems(items)
    } catch (error) {
      console.error('Error loading items to like:', error)
      toast.add({
        title: "Couldn't load posts",
        description: 'Try again.',
        color: 'error',
        duration: 3000,
      })
      return null
    }
  }

  return { isLikingAll, likedSoFar, likeAllTotal, likeAllItems, likeAllIn }
}
