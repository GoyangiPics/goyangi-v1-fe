import type { MaybeRefOrGetter } from 'vue'
import type { ContentsItem } from '~/types/appTypes'
import { computed, nextTick, onScopeDispose, ref, toValue } from 'vue'

/**
 * Shared like / copy / download behavior for content cards. Builds on
 * `useLikeItem` (optimistic like state) and adds the like "cat-ear" pop
 * animation, AVIF copy, and original-file download. Accepts a plain item
 * or a getter for carousel-style cards.
 */
export function useContentCard(content: MaybeRefOrGetter<ContentsItem | null>) {
  const toast = useToast()
  const { isLiked, isPending, likeContent } = useLikeItem(content)

  const isLikeAnimating = ref(false)
  let likeAnimTimer: ReturnType<typeof setTimeout> | null = null

  // Lucide has no filled heart variant — consumers render
  // `<UIcon :name="likeIcon">` and add `icon-filled` when liked.
  const likeIcon = computed(() => 'i-lucide-heart')
  const likeCount = computed(() => `${toValue(content)?.expand?.likes?.length ?? 0}`)

  async function handleLike() {
    const wasLiked = isLiked.value
    await likeContent()
    if (!wasLiked && isLiked.value) {
      isLikeAnimating.value = false
      await nextTick()
      isLikeAnimating.value = true
      if (likeAnimTimer) clearTimeout(likeAnimTimer)
      likeAnimTimer = setTimeout(() => {
        isLikeAnimating.value = false
      }, 1200)
    }
  }

  async function copyAvif() {
    const avifUrl = toValue(content)?.preview
    if (!avifUrl) {
      toast.add({
        title: 'Nothing to copy',
        description: 'This post has no preview link.',
        color: 'warning',
        duration: 2000,
      })
      return
    }
    await navigator.clipboard.writeText(avifUrl)
    toast.add({ title: 'Link copied', color: 'info', duration: 1000 })
  }

  function download() {
    const url = toValue(content)?.original
    if (url) void downloadFile(url)
  }

  onScopeDispose(() => {
    if (likeAnimTimer) clearTimeout(likeAnimTimer)
  })

  return {
    isLiked,
    isPending,
    likeContent,
    isLikeAnimating,
    likeIcon,
    likeCount,
    handleLike,
    copyAvif,
    download,
  }
}
