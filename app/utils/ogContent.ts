import type PocketBase from 'pocketbase'

/**
 * A set's or collection's social embed borrows one of its items, and picking the
 * wrong one produces a link that unfurls to nothing.
 *
 * `preview` and `original` are written by the R2 encode hook, in a single save
 * at the end of the job — so a record created seconds ago by an upload has
 * neither. Sharing a set link mid-upload therefore picked the newest item,
 * which is precisely the one still encoding, and Discord got an empty og:image.
 */

/**
 * Whether a content record can produce an embed at all.
 *
 * Mirrors what useDetailSeo actually reads: og:image is `preview || original`
 * (or the mp4 `original` in video mode), so a record with neither renders
 * nothing whichever branch it takes. `preview` alone would be nearly enough —
 * the two are saved together — but the video path can fall back to setting only
 * a rendition URL, and the pair costs nothing to check.
 */
const EMBEDDABLE = 'preview != "" || original != ""'

/**
 * The newest item in `scopeFilter` that can carry an embed, falling back to the
 * newest item of any kind.
 *
 * The fallback matters: while the very first upload into a brand-new set is
 * still encoding there IS no embeddable item, and the caller still wants the
 * item's `source` for the page's Source button. That case costs a second query;
 * every other case is one.
 */
export async function firstEmbeddableContent(
  pb: PocketBase,
  scopeFilter: string,
): Promise<Record<string, any> | null> {
  const newest = async (filter: string) => {
    const page = await pb.collection('contents').getList(1, 1, { filter, sort: '-created' })
    return (page.items[0] as Record<string, any> | undefined) ?? null
  }

  const embeddable = await newest(`(${scopeFilter}) && (${EMBEDDABLE})`)
  if (embeddable) return embeddable
  return newest(scopeFilter)
}
