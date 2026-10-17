import type { MaybeRefOrGetter } from 'vue'
import type { ContentsItem } from '~/types/appTypes'
import { computed, ref, toValue } from 'vue'
import { runPool } from '~/utils/bulkPool'

const OPTIMISTIC_LIKE_ID = '__optimistic__'

/** Same concurrency as useLikeAll; see the note on its constant. */
const CONCURRENCY = 4

/**
 * The grouped view's heart: one toggle for a whole set.
 *
 * Liked means every item in it is liked. Tapping likes whatever isn't yet, or,
 * when everything already is, removes all of this user's likes from the set —
 * the single heart's toggle, set-wide.
 *
 * Optimistic like useLikeItem, so the heart answers the tap at once rather than
 * after a round of requests per item; anything that then fails is rolled back
 * and counted in one toast. No progress toast: this is the heart's default
 * action, and the menu's "Like whole set" keeps the chatty one.
 *
 * Mutates each item's `expand.likes` in place, which is what every heart and
 * count on screen already reads, so the carousel's other items update too.
 */
export function useLikeSet(items: MaybeRefOrGetter<ContentsItem[]>) {
  const authStore = useAuthStore()
  const toast = useToast()
  const { requireAuth } = useAuthGate()
  const { createLike, removeLike } = useLikeApi()

  const isPending = ref(false)

  function userLike(item: ContentsItem, userId: string) {
    return item.expand?.likes?.find((l) => l.user === userId)
  }

  const isSetLiked = computed(() => {
    const userId = authStore.user?.id
    const list = toValue(items)
    return !!userId && list.length > 0 && list.every((item) => !!userLike(item, userId))
  })

  async function likeAll(list: ContentsItem[], userId: string) {
    const pending = list.filter((item) => !userLike(item, userId))
    for (const item of pending) {
      if (!item.expand) item.expand = {}
      if (!item.expand.likes) item.expand.likes = []
      item.expand.likes.push({ id: OPTIMISTIC_LIKE_ID, user: userId, content: item.id } as any)
    }

    const result = await runPool(
      pending,
      async (item) => {
        const record = await createLike(userId, item.id)
        const likes = item.expand?.likes ?? []
        const idx = likes.findIndex((l) => l.id === OPTIMISTIC_LIKE_ID)
        if (idx !== -1) likes.splice(idx, 1, { ...record })
      },
      { concurrency: CONCURRENCY },
    )

    for (const { item, error } of result.failed) {
      const likes = item.expand?.likes ?? []
      const idx = likes.findIndex((l) => l.id === OPTIMISTIC_LIKE_ID)
      if (idx !== -1) likes.splice(idx, 1)
      console.error('Error liking content:', item.id, error)
    }
    return result.failed.length
  }

  async function unlikeAll(list: ContentsItem[], userId: string) {
    const liked = list
      .map((item) => ({ item, like: userLike(item, userId) }))
      .filter(
        (entry): entry is { item: ContentsItem; like: NonNullable<typeof entry.like> } =>
          // An optimistic row has no record to delete yet.
          !!entry.like && entry.like.id !== OPTIMISTIC_LIKE_ID,
      )
    for (const { item, like } of liked) {
      const likes = item.expand?.likes ?? []
      likes.splice(likes.indexOf(like), 1)
    }

    const result = await runPool(liked, ({ item, like }) => removeLike(like.id, item.id), {
      concurrency: CONCURRENCY,
    })

    for (const { item: entry, error } of result.failed) {
      entry.item.expand?.likes?.push(entry.like)
      console.error('Error unliking content:', entry.item.id, error)
    }
    return result.failed.length
  }

  /** Likes the whole set, or unlikes it when it is already fully liked. */
  async function toggleSetLike() {
    if (!requireAuth('like posts')) return
    const userId = authStore.user?.id
    const list = toValue(items)
    if (!userId || isPending.value || list.length === 0) return

    isPending.value = true
    const unliking = isSetLiked.value
    try {
      const failed = unliking ? await unlikeAll(list, userId) : await likeAll(list, userId)
      if (failed) {
        toast.add({
          title: unliking ? "Couldn't unlike every post" : "Couldn't like every post",
          description: `${failed} of ${list.length} failed. Try again.`,
          color: 'error',
          duration: 3000,
        })
      }
    } finally {
      isPending.value = false
    }
  }

  return { isSetLiked, isPending, toggleSetLike }
}
