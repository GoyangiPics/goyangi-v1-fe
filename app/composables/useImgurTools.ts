import { ref } from 'vue'

export interface ImgurItem {
  id: number
  file: string
  title: string
}

/**
 * Shared Imgur-link state for the tools pages: extracts imgur links from any
 * pasted text (markdown, emoji separators, Discord mentions…), normalizes them
 * to direct media links, builds the preview grid, and bulk-downloads.
 *
 * The parsing itself lives in ~/utils/imgurLinks (pure, unit-tested); this is
 * the reactive shell around it.
 */
export function useImgurTools() {
  const pb = usePocketBase()
  const router = useRouter()
  const toast = useToast()
  const { requireAuth } = useAuthGate()

  const rawInput = ref('')
  const items = ref<ImgurItem[]>([])

  /** Replace the textarea contents with just the cleaned links, one per line. */
  function normalizeLinks() {
    rawInput.value = extractImgurLinks(rawInput.value).join('\n')
  }

  function generateItems() {
    const links = extractImgurLinks(rawInput.value)
    rawInput.value = links.join('\n')
    let id = 0
    items.value = links.map((link) => ({ id: ++id, file: link, title: link }))
  }

  /** The non-empty, trimmed lines — handy for persisting/creating records. */
  function linkLines(): string[] {
    return rawInput.value
      .split('\n')
      .map((link) => link.trim())
      .filter(Boolean)
  }

  async function downloadAll() {
    const links = extractImgurLinks(rawInput.value)
    rawInput.value = links.join('\n')
    for (const link of links) await downloadFile(link)
    return links.length
  }

  /**
   * Persist the current links as a users_links record and open its page.
   *
   * Both tools pages used to carry their own near-copy of this; they had even
   * drifted on the default title ('Generated Link' vs the dated form) and on
   * whether an empty textarea was caught before the create.
   */
  async function shareAsLink() {
    normalizeLinks()

    if (!requireAuth('share a link')) return
    const userId = pb.authStore.record!.id

    const linksArray = linkLines()
    if (linksArray.length === 0) {
      toast.add({
        title: 'No links',
        description: 'Paste at least one Imgur link.',
        color: 'warning',
        duration: 2000,
      })
      return
    }

    try {
      const record = await pb.collection('users_links').create({
        user: userId,
        title: `Tools ${formatShortDate(new Date().toISOString())}`,
        links: linksArray,
      })
      void router.push(`/tools/${record.id}`)
    } catch (error) {
      console.error('Failed to create PocketBase record:', error)
      toast.add({ title: "Couldn't share", color: 'error', duration: 2500 })
    }
  }

  return {
    /** The raw textarea contents (v-model this). */
    inputLinks: rawInput,
    items,
    normalizeLinks,
    generateItems,
    linkLines,
    downloadAll,
    shareAsLink,
  }
}
