import { onMounted, ref } from 'vue'

/**
 * Cross-page title handoff: CardStackedContent stores the clicked set or
 * collection title in localStorage right before navigating, and the
 * destination page displays it once (see PageHandoffTitle).
 */
export function usePageTitleHandoff() {
  const pageTitle = ref<string | null>(null)

  onMounted(() => {
    pageTitle.value = localStorage.getItem('pageTitle')
    localStorage.removeItem('pageTitle')
  })

  return { pageTitle }
}
