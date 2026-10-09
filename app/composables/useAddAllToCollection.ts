import type { ContentsItem } from '~/types/appTypes'
import type { RecordIdString } from '~/types/pocketbase-types'
import { ref } from 'vue'

export interface AddAllResult {
  added: number
  /** Already in every chosen collection before we started. */
  skipped: number
  failed: number
}

/**
 * How many adds run at once.
 *
 * Same figure and same reasoning as LIKE_ALL_CONCURRENCY in useLikeAll: this is
 * one request per item, and PocketBase's built-in rate limiter is a runtime
 * setting we can't read from here.
 */
const ADD_ALL_CONCURRENCY = 4

/**
 * The chosen collections this item is not in yet.
 *
 * `collections` is a plain relation field on the record, not an expand, so it is
 * present on anything fetched without `fields` narrowing it away — unlike likes,
 * which useLikeAll has to reason about expand-by-expand.
 */
function missingFrom(item: ContentsItem, collectionIds: RecordIdString[]): RecordIdString[] {
  const current = new Set(item.collections ?? [])
  return collectionIds.filter((id) => !current.has(id))
}

/**
 * Bulk "add everything in this set to a collection".
 *
 * The counterpart to useLikeAll, and deliberately shaped like it: same worker
 * pool, same live progress toast, same in-place optimistic mutation. The one
 * structural difference is that this takes the collections to add to — you can
 * like a set with a single click, but you have to say *which* collection to add
 * it to, which is why this is driven from QuickCollectionModal rather than
 * straight off a menu entry.
 */
export function useAddAllToCollection() {
  const pb = usePocketBase()
  const toast = useToast()
  const { requireAuth } = useAuthGate()
  const { addToCollections } = useCollectionApi()

  const isAddingAll = ref(false)
  const addedSoFar = ref(0)
  const addAllTotal = ref(0)

  /**
   * Adds every item that isn't already in the chosen collections.
   *
   * Mutates each item's `collections` in place so a subsequently opened
   * QuickCollectionModal shows the right boxes ticked without a refetch — it
   * reads that same array to seed its selection.
   */
  async function addAllItems(
    items: ContentsItem[],
    collectionIds: RecordIdString[],
  ): Promise<AddAllResult | null> {
    if (!requireAuth('add posts to collections')) return null
    if (!collectionIds.length || isAddingAll.value) return null

    // Resolved up front rather than inside the worker: `skipped` is the count of
    // items that need no request at all, and the toast quotes it before the run.
    const pending = items
      .map((item) => ({ item, missing: missingFrom(item, collectionIds) }))
      .filter((entry) => entry.missing.length > 0)

    const result: AddAllResult = {
      added: 0,
      skipped: items.length - pending.length,
      failed: 0,
    }

    if (pending.length === 0) {
      toast.add({
        title: 'Already added',
        description: `${items.length === 1 ? 'This post is' : `All ${items.length} posts are`} already in there.`,
        color: 'info',
        duration: 2000,
      })
      return result
    }

    isAddingAll.value = true
    addedSoFar.value = 0
    addAllTotal.value = pending.length

    // duration: 0 disables the auto-close timer, and has to be repeated on every
    // update() — Nuxt UI's update sets duration from the toast's own value
    // unconditionally, so omitting it resurrects the timer mid-run.
    const progress = toast.add({
      title: 'Adding to collection…',
      description: `0/${pending.length}`,
      color: 'info',
      duration: 0,
    })

    // Worker pool over a shared cursor, rather than chunked batches: a slow
    // request in one chunk would otherwise idle the rest.
    let cursor = 0
    async function worker() {
      while (cursor < pending.length) {
        const entry = pending[cursor++]
        if (!entry) continue
        try {
          await addToCollections(entry.item.id, entry.missing)
          entry.item.collections = [...(entry.item.collections ?? []), ...entry.missing]
          result.added++
        } catch (error) {
          result.failed++
          console.error('Error adding content to collection:', entry.item.id, error)
        }
        addedSoFar.value = result.added + result.failed
        toast.update(progress.id, {
          description: `${addedSoFar.value}/${pending.length}`,
          duration: 0,
        })
      }
    }

    await Promise.all(Array.from({ length: Math.min(ADD_ALL_CONCURRENCY, pending.length) }, worker))

    const parts: string[] = []
    if (result.skipped) parts.push(`${result.skipped} already there`)
    if (result.failed) parts.push(`${result.failed} failed`)

    toast.update(progress.id, {
      title:
        result.added === 0 && result.failed > 0
          ? "Couldn't add posts"
          : `Added ${result.added} post${result.added === 1 ? '' : 's'}`,
      description: parts.length ? parts.join(' · ') : undefined,
      color: result.failed ? 'warning' : 'success',
      duration: 3000,
    })

    isAddingAll.value = false
    return result
  }

  /**
   * Adds an entire set or collection, fetching its members first.
   *
   * Prefer addAllItems when the caller already holds the items (CardUnified
   * does) — this costs an extra request.
   *
   * `opts.live` lets a caller hand in the objects it has on screen, so the
   * in-place mutation lands on the rendered instances rather than on the private
   * copies fetched here. Unconditional, unlike useLikeAll's equivalent: every
   * record carries `collections` as a plain field, so a live object can always
   * answer "already in there?" and swapping it in can never cause a re-add.
   */
  async function addAllIn(
    target: { setId: string } | { collectionId: string },
    collectionIds: RecordIdString[],
    opts: { live?: ContentsItem[] } = {},
  ): Promise<AddAllResult | null> {
    if (!requireAuth('add posts to collections')) return null
    if (!collectionIds.length) return null

    const filter =
      'setId' in target
        ? pb.filter('set={:id}', { id: target.setId })
        : pb.filter('collections~{:id}', { id: target.collectionId })

    try {
      // `fields` narrowed to what the write needs. The full record is only
      // required for the live instances, and those come from the caller.
      const fetched = await pb.collection('contents').getFullList<ContentsItem>({
        filter,
        fields: 'id,collections',
        requestKey: null,
      })

      const live = new Map((opts.live ?? []).map((item) => [item.id, item]))
      const items = fetched.map((record) => live.get(record.id) ?? record)

      if (items.length === 0) {
        toast.add({
          title: 'No posts to add',
          color: 'warning',
          duration: 2000,
        })
        return { added: 0, skipped: 0, failed: 0 }
      }
      return await addAllItems(items, collectionIds)
    } catch (error) {
      console.error('Error loading items to add:', error)
      toast.add({
        title: "Couldn't load posts",
        description: 'Try again.',
        color: 'error',
        duration: 3000,
      })
      return null
    }
  }

  return { isAddingAll, addedSoFar, addAllTotal, addAllItems, addAllIn }
}
