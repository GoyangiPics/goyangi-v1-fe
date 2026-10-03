import type { ContentsItem } from '~/types/appTypes'
import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, toValue } from 'vue'

/**
 * A fullscreen viewer owned by the LISTING, not by the card.
 *
 * Every card used to open its own DialogBaseFullscreen, which knew about one
 * item — so prev/next only existed inside CardUnified, the one card that holds
 * a whole set. On the set page, the collection page and the ungrouped home
 * grid, zooming in was a dead end: no arrows, no swipe, close and click the
 * next one. This lifts the viewer to the page, where the page's own `items`
 * are the thing to step through.
 *
 * Tracked by id rather than index: a refetch (a like, an admin edit) replaces
 * the array, and the viewer must stay on the same item, not the same slot.
 */
export function useListingFullscreen(items: MaybeRefOrGetter<ContentsItem[]>) {
  const activeId = ref<string | null>(null)
  const autoplay = ref(false)

  const list = computed(() => toValue(items))
  const activeIndex = computed(() => list.value.findIndex((item) => item.id === activeId.value))
  const activeContent = computed<ContentsItem | null>(() =>
    activeIndex.value === -1 ? null : (list.value[activeIndex.value] ?? null),
  )
  const count = computed(() => list.value.length)
  const hasNavigation = computed(() => count.value > 1)
  /** The item one step forward, for the viewer to keep loaded. Null at the end. */
  const nextContent = computed<ContentsItem | null>(() =>
    activeIndex.value === -1 ? null : (list.value[activeIndex.value + 1] ?? null),
  )

  function open(content: ContentsItem, withAutoplay = false) {
    autoplay.value = withAutoplay
    activeId.value = content.id
  }

  function close() {
    activeId.value = null
    autoplay.value = false
  }

  /** Clamped, not wrapped — the same behaviour as a set carousel\'s ends. */
  function step(delta: number) {
    const next = activeIndex.value + delta
    const target = list.value[next]
    if (target) activeId.value = target.id
  }

  return {
    activeContent,
    activeIndex,
    nextContent,
    count,
    hasNavigation,
    autoplay,
    open,
    close,
    prev: () => step(-1),
    next: () => step(1),
  }
}
