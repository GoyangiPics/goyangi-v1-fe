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

  /**
   * Like copyLinks, for links that have to be fetched first (a whole set from
   * a card's menu).
   *
   * Safari only lets a page write the clipboard during the click itself, and a
   * fetch ends that. So the write starts synchronously with a ClipboardItem
   * whose text is a promise, which every current browser accepts; the plain
   * await-then-writeText path is only the fallback for browsers without it.
   */
  async function copyLinksFrom(load: () => Promise<string[]>, label: string) {
    const kind = linkKind(label)
    let count = 0
    let empty = false
    const text = load().then((urls) => {
      count = urls.length
      empty = count === 0
      if (empty) throw new Error('nothing to copy')
      return urls.join('\n')
    })
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        const blob = text.then((t) => new Blob([t], { type: 'text/plain' }))
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })])
      } else {
        await navigator.clipboard.writeText(await text)
      }
      toast.add({
        title: count === 1 ? `${kind} link copied` : `${count} ${kind} links copied`,
        color: 'success',
        duration: 2000,
      })
    } catch {
      // A load that found no links rejects too; wait for it to say which.
      await text.catch(() => {})
      toast.add({
        title: empty ? 'Nothing to copy' : "Couldn't copy links",
        description: empty ? `No ${kind} links here.` : undefined,
        color: empty ? 'warning' : 'error',
        duration: 3000,
      })
    }
  }

  return { copyLinks, copyLink, copyLinksFrom }
}
