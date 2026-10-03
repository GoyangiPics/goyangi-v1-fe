/**
 * Clipboard writes for content links, with the toast.
 *
 * Absorbs the upload panel's `copyAll` and gives ContentActionsMenu's three
 * near-identical copy helpers one implementation.
 */
export function useCopyLinks() {
  const toast = useToast()

  /** Newline-joined, for pasting a block into Discord. No-ops on empty. */
  async function copyLinks(urls: string[], label: string) {
    if (urls.length === 0) return
    try {
      await navigator.clipboard.writeText(urls.join('\n'))
      toast.add({
        title: `Copied ${urls.length} ${label} link${urls.length === 1 ? '' : 's'}`,
        color: 'success',
        duration: 2000,
      })
    } catch {
      toast.add({
        title: 'Error',
        description: 'Failed to copy to the clipboard.',
        color: 'error',
        duration: 3000,
      })
    }
  }

  /** One URL. `label` names the rendition in the toast. */
  async function copyLink(url: string | undefined | null, label: string) {
    if (!url) {
      toast.add({
        title: 'Nothing to copy',
        description: `This item has no ${label.toLowerCase()} link.`,
        color: 'warning',
        duration: 2000,
      })
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.add({
        title: 'Copied!',
        description: `${label} link copied to clipboard.`,
        color: 'info',
        duration: 1000,
      })
    } catch {
      toast.add({
        title: 'Error',
        description: 'Failed to copy the link.',
        color: 'error',
        duration: 3000,
      })
    }
  }

  return { copyLinks, copyLink }
}
