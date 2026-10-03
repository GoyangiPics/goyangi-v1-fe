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
export function useDownloadAll() {
  const toast = useToast()

  const isDownloadingAll = ref(false)

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
      const label = RENDITION_LABEL[rendition]
      let count = 0
      let skipped = 0

      for (const item of items) {
        const url = renditionUrl(item, rendition)
        // Still encoding, or — for SD — a record predating that rendition.
        if (!url) {
          skipped++
          continue
        }
        await downloadFile(url)
        count++
      }

      if (count === 0) {
        toast.add({
          title: 'Nothing to download',
          description: `None of these items has ${label === 'SD' ? 'an SD' : 'an HD'} file.`,
          color: 'warning',
          duration: 3000,
        })
        return
      }

      toast.add({
        title: 'Done!',
        // The skipped count is stated rather than swallowed: silently handing
        // over fewer files than there are items on screen reads as a failure.
        description:
          `Downloaded ${count} ${label} file${count === 1 ? '' : 's'}.` +
          (skipped > 0 ? ` ${skipped} had no ${label} version and were skipped.` : ''),
        color: skipped > 0 ? 'warning' : 'success',
        duration: skipped > 0 ? 4000 : 2000,
      })
    } finally {
      isDownloadingAll.value = false
    }
  }

  return { isDownloadingAll, downloadAll }
}
