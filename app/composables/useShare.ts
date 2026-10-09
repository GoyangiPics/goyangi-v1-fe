import { onMounted, ref } from 'vue'

/**
 * The device's own share sheet (navigator.share), for detail pages.
 *
 * On a phone, sharing a find means sending it somewhere — a chat, a story —
 * and the copy-link entries make that two apps and a paste. The sheet goes
 * straight to the target.
 *
 * `canShare` starts false and is set on mount: the pages are server-rendered,
 * the server has no navigator, and a button that appeared only on the client
 * would fail hydration. Callers show the button only when it's true, so no
 * desktop gets a control that can't do anything.
 */
export function useShare() {
  const canShare = ref(false)
  const toast = useToast()

  onMounted(() => {
    canShare.value = typeof navigator.share === 'function'
  })

  /** Shares this page — origin and path, without the query of whatever filter got here. */
  async function sharePage(title?: string | null) {
    const url = `${window.location.origin}${window.location.pathname}`
    try {
      await navigator.share({ title: title || 'Goyangi', url })
    } catch (error) {
      // Dismissing the sheet rejects with AbortError; that's a choice, not a failure.
      if ((error as Error)?.name === 'AbortError') return
      toast.add({
        title: 'Could not share',
        description: 'Copy the link from the menu instead.',
        color: 'warning',
        duration: 3000,
      })
    }
  }

  return { canShare, sharePage }
}
