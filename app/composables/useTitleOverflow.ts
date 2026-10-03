import { ref } from 'vue'

/**
 * Detects whether a card's title badge is truncated, so the card can show
 * a tooltip with the full text only when needed. The badge marks its label
 * span with `card-title-label` (via UBadge's `:ui`). `titleTagRef` may be a
 * DOM element or a component instance (hence the `$el` unwrap).
 */
export function useTitleOverflow() {
  const titleTagRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
  const titleOverflows = ref(false)

  function checkTitleOverflow() {
    const r = titleTagRef.value
    const root = (r && '$el' in r ? r.$el : r) as HTMLElement | undefined
    const el = root?.querySelector('.card-title-label') as HTMLElement | null
    titleOverflows.value = !!el && el.scrollWidth > el.clientWidth
  }

  return { titleTagRef, titleOverflows, checkTitleOverflow }
}
