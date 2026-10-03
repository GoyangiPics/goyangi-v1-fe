import type { RecordIdString } from '~/types/pocketbase-types'

/**
 * The `contents.collections` writes, in one place.
 *
 * The same extraction useLikeApi is: QuickCollectionModal held the app's only
 * copy of these two updates, so the bulk path in useAddAllToCollection would
 * have had to carry a second one.
 *
 * ## Why every call passes `requestKey: null`
 *
 * The PocketBase SDK auto-cancels an in-flight request when a new one shares its
 * key, and the default key is `method + path`. `contents.update` embeds the
 * record id in the path, so *distinct* records were always safe — but the bulk
 * path fires these concurrently and nothing here should ever be silently
 * aborted, and the same-record case (the quick modal's add-then-remove pair) is
 * two updates on one path back to back.
 */
export function useCollectionApi() {
  const pb = usePocketBase()

  /** Links a content record to every listed collection. No-op for an empty list. */
  async function addToCollections(
    contentId: string,
    collectionIds: RecordIdString[],
  ): Promise<void> {
    if (!collectionIds.length) return
    await pb
      .collection('contents')
      .update(contentId, { 'collections+': collectionIds }, { requestKey: null })
  }

  /** Unlinks a content record from every listed collection. */
  async function removeFromCollections(
    contentId: string,
    collectionIds: RecordIdString[],
  ): Promise<void> {
    if (!collectionIds.length) return
    await pb
      .collection('contents')
      .update(contentId, { 'collections-': collectionIds }, { requestKey: null })
  }

  return { addToCollections, removeFromCollections }
}
