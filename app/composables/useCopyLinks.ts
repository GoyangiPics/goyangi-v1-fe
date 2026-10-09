/**
 * Clipboard writes for content links, with the toast.
 *
 * Absorbs the upload panel's `copyAll` and gives ContentActionsMenu's three
 * near-identical copy helpers one implementation.
 */
/** "HD" / "SD" stay as written; "Preview" reads as a word mid-sentence. */
function linkKind(label: string): string {
  return label === 'Preview' ? 'preview' : label
}

export function useCopyLinks() {
  const toast = useToast()

  /** Newline-joined, for pasting a block into Discord. No-ops on empty. */
  async function copyLinks(urls: string[], label: string) {
    if (urls.length === 0) return
    const kind = linkKind(label)
    try {
      await navigator.clipboard.writeText(urls.join('\n'))
      toast.add({
        title: urls.length === 1 ? `${kind} link copied` : `${urls.length} ${kind} links copied`,
        color: 'success',
        duration: 2000,
      })
    } catch {
      toast.add({
        title: "Couldn't copy links",
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
        description: `This post has no ${linkKind(label)} link.`,
        color: 'warning',
        duration: 2000,
      })
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.add({
        title: 'Link copied',
        color: 'info',
        duration: 1000,
      })
    } catch {
      toast.add({
        title: "Couldn't copy link",
        color: 'error',
        duration: 3000,
      })
    }
  }

  return { copyLinks, copyLink }
}
