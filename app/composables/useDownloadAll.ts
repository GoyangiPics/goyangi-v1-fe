import { ref } from 'vue'

/** Which rendition a bulk download hands over. */
export type DownloadRendition = 'hd' | 'sd'

/** Anything carrying the two video rendition URLs — a `contents` record, in practice. */
export interface DownloadableItem {
  /** AV1 1080p, the canonical rendition. */
  original?: string
  /** H.264 720p, the compatibility rendition. Best-effort, so often absent. */
  sd?: string
}

const RENDITION_LABEL: Record<DownloadRendition, string> = { hd: 'HD', sd: 'SD' }

/**
 * The URL for a rendition, or undefined when this item hasn't got it.
 *
 * Deliberately NO fallback from sd to original: `sd` exists because Safari never
 * software-decodes AV1, so substituting the AV1 file would hand the unplayable
 * rendition to precisely the device that asked for the playable one. Missing is
 * reported instead — see downloadAll.
 */
export function renditionUrl(
  item: DownloadableItem,
  rendition: DownloadRendition,
): string | undefined {
  return rendition === 'sd' ? item.sd : item.original
}

/** How many of these items can supply the rendition. Drives the menu's counts. */
export function renditionCount(
  items: readonly DownloadableItem[],
  rendition: DownloadRendition,
): number {
  return items.reduce((n, item) => (renditionUrl(item, rendition) ? n + 1 : n), 0)
}

/**
 * Bulk "download everything on screen", with the in-progress flag and the
 * summary toast.
 *
 * Extracted from set/[id].vue so the collection page offers the same action
 * rather than carrying a second copy — the same move useCopyLinks made for the
 * clipboard helpers.
 *
 * Scope note worth knowing before wiring this to a button labelled "Download
 * All": it downloads the items it is handed, which on a paginated listing is the
 * current page, not the whole set or collection. That is the behaviour the set
 * page has always had.
 */
/**
 * One bulk download at a time, page-wide. Module-level because the set-wide
 * download starts from a card's context menu, and every card has its own
 * instance of this composable — a per-instance flag let two sets download
 * interleaved, and left the set page's button idle while one ran.
 */
const isDownloadingAll = ref(false)

export function useDownloadAll() {
  const toast = useToast()
  const pb = usePocketBase()

  /**
   * Fetches each item's chosen rendition in turn.
   *
   * Sequential deliberately: every item is a full-size file fetched into a blob
   * and handed to a synthetic anchor click, so firing a page's worth at once
   * both saturates the connection and trips the browser's own
   * multiple-downloads heuristics.
   */
  async function downloadAll(
    items: readonly DownloadableItem[],
    rendition: DownloadRendition = 'hd',
  ) {
    if (isDownloadingAll.value) return
    isDownloadingAll.value = true
    try {
      await run(items, rendition)
    } finally {
      isDownloadingAll.value = false
    }
  }

  /**
   * Downloads every item in a set — all of it, not a page of it — from wherever
   * the set's items aren't on screen: a card's context menu on a listing.
   *
   * Shows a progress toast, which the set page's button doesn't need: there the
   * button's own spinner says something is happening, whereas a menu closes the
   * moment it's clicked and would otherwise leave a minutes-long run invisible.
   */
  async function downloadAllIn(target: { setId: string }, rendition: DownloadRendition = 'hd') {
    if (isDownloadingAll.value) {
      toast.add({
        title: 'Already downloading',
        description: 'Wait for it to finish.',
        color: 'info',
        duration: 2000,
      })
      return
    }
    isDownloadingAll.value = true
    try {
      let items: DownloadableItem[]
      try {
        items = await pb.collection('contents').getFullList<DownloadableItem>({
          filter: pb.filter('set={:id}', { id: target.setId }),
          fields: 'id,original,sd',
          sort: 'created',
          requestKey: null,
        })
      } catch (error) {
        console.error('Error loading items to download:', error)
        toast.add({
          title: "Couldn't load this set",
          description: 'Try again.',
          color: 'error',
          duration: 3000,
        })
        return
      }
      await run(items, rendition, { progress: true })
    } finally {
      isDownloadingAll.value = false
    }
  }

  async function run(
    items: readonly DownloadableItem[],
    rendition: DownloadRendition,
    opts: { progress?: boolean } = {},
  ) {
    const label = RENDITION_LABEL[rendition]
    const total = renditionCount(items, rendition)
    let count = 0
    let skipped = 0

    // duration: 0 on every update — see useLikeAll for why it has to be repeated.
    const progress =
      opts.progress && total > 0
        ? toast.add({
            title: `Downloading ${label} files…`,
            description: `0/${total}`,
            color: 'info',
            duration: 0,
          })
        : null

    for (const item of items) {
      const url = renditionUrl(item, rendition)
      // Still encoding, or — for SD — a record predating that rendition.
      if (!url) {
        skipped++
        continue
      }
      await downloadFile(url)
      count++
      if (progress) toast.update(progress.id, { description: `${count}/${total}`, duration: 0 })
    }

    if (count === 0) {
      toast.add({
        title: 'Nothing to download',
        description: `None of these posts have ${label === 'SD' ? 'an SD' : 'an HD'} version.`,
        color: 'warning',
        duration: 3000,
      })
      return
    }

    const summary = {
      title: `Downloaded ${count} ${label} file${count === 1 ? '' : 's'}`,
      // The skipped count is stated rather than swallowed: silently handing
      // over fewer files than there are items on screen reads as a failure.
      description: skipped > 0 ? `Skipped ${skipped} with no ${label} version.` : undefined,
      color: skipped > 0 ? ('warning' as const) : ('success' as const),
      duration: skipped > 0 ? 4000 : 2000,
    }
    if (progress) toast.update(progress.id, summary)
    else toast.add(summary)
  }

  return { isDownloadingAll, downloadAll, downloadAllIn }
}
