import type { MaybeRefOrGetter } from 'vue'
import type { ContentsItem } from '~/types/appTypes'
import { computed, ref, toValue } from 'vue'

const OPTIMISTIC_LIKE_ID = '__optimistic__'

/**
 * Optimistic like/unlike for a content item. Accepts a plain item or a
 * getter (e.g. CardUnified's active carousel item) — liked state re-syncs
 * whenever the resolved item changes.
 */
export function useLikeItem(content: MaybeRefOrGetter<ContentsItem | null>) {
  const authStore = useAuthStore()
  const toast = useToast()
  const { requireAuth } = useAuthGate()
  const { createLike, removeLike } = useLikeApi()

  const isPending = ref(false)

  /**
   * Derived from the likes array, not a ref kept in step with it.
   *
   * It used to be a ref updated by `watch(() => toValue(content))`, which fires
   * only when the *item* changes. useLikeAll mutates `expand.likes` in place, so
   * a bulk like left the heart white until something replaced the item — a
   * carousel swap or a refetch — even though the count beside it, a computed over
   * the same array, had already gone up.
   *
   * Reading through to the array also means signing in re-colours every heart on
   * screen, which the old watcher never did either.
   *
   * The optimistic paths below push and splice that array, so they still flip
   * this immediately without a second piece of state to keep aligned.
   */
  const isLiked = computed(() => {
    const userId = authStore.user?.id
    if (!userId) return false
    return !!toValue(content)?.expand?.likes?.some((l) => l.user === userId)
  })

  async function likeContent() {
    const c = toValue(content)
    if (!requireAuth('like posts')) return

    const userId = authStore.user?.id
    if (!c || !userId || isPending.value) return

    if (!c.expand) c.expand = {} as any
    if (!c.expand!.likes) c.expand!.likes = []
    const likes = c.expand!.likes

    isPending.value = true

    if (isLiked.value) {
      const likeRecord = likes.find((l) => l.user === userId)
      if (!likeRecord) {
        isPending.value = false
        return
      }

      // Optimistic update — removing the row is what un-colours the heart.
      const idx = likes.findIndex((l) => l.id === likeRecord.id)
      if (idx !== -1) likes.splice(idx, 1)

      try {
        await removeLike(likeRecord.id, c.id)
      } catch (error) {
        // Rollback
        likes.push(likeRecord as any)
        console.error('Error unliking content:', error)
        toast.add({
          title: "Couldn't unlike",
          color: 'error',
          duration: 1000,
        })
      }
    } else {
      // Optimistic update — the pushed row is what colours the heart.
      const optimisticLike = { id: OPTIMISTIC_LIKE_ID, user: userId, content: c.id } as any
      likes.push(optimisticLike)

      try {
        const likeRecord = await createLike(userId, c.id)
        const idx = likes.findIndex((l) => l.id === OPTIMISTIC_LIKE_ID)
        if (idx !== -1) likes.splice(idx, 1, { ...likeRecord } as any)
      } catch (error) {
        // Rollback
        const idx = likes.findIndex((l) => l.id === OPTIMISTIC_LIKE_ID)
        if (idx !== -1) likes.splice(idx, 1)
        console.error('Error liking content:', error)
        toast.add({
          title: "Couldn't like",
          color: 'error',
          duration: 1000,
        })
      }
    }

    isPending.value = false
  }

  return {
    isLiked,
    isPending,
    likeContent,
  }
}
