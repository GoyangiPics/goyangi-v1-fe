import type { Like } from '~/types/appTypes'

/**
 * The two writes a like is made of, in one place.
 *
 * A like is denormalised in both directions: a row in `users_likes` and an entry
 * in the `contents.likes` back-relation. That pair was written out three times
 * (like and unlike in useLikeItem, plus a copy inside set/[id].vue's likeAll).
 *
 * ## Why every call passes `requestKey: null`
 *
 * The PocketBase SDK auto-cancels an in-flight request when a new one shares its
 * key, and the default key is `method + path`. `users_likes.create` has a
 * *fixed* path, so two concurrent creates cancel each other.
 *
 * Two consequences. Bulk liking with any concurrency at all is impossible
 * without this — most of the batch would reject with `isAbort`. And it was
 * already a latent bug for single likes: tapping two cards quickly could abort
 * the first create, sending useLikeItem down its rollback path with a spurious
 * "Failed to like content" toast. uploads.vue already works around the same trap
 * for its parallel polls.
 *
 * `contents.update` embeds the record id in the path, so distinct records were
 * always safe there — but it is passed for the same-record case and for
 * symmetry.
 */
export function useLikeApi() {
  const pb = usePocketBase()

  /** Creates the join row, then points the content at it. Returns the row. */
  async function createLike(userId: string, contentId: string): Promise<Like> {
    const likeRecord = await pb
      .collection('users_likes')
      .create<Like>({ user: userId, content: contentId }, { requestKey: null })
    await pb
      .collection('contents')
      .update(contentId, { 'likes+': likeRecord.id }, { requestKey: null })
    return likeRecord
  }

  /** Deletes the join row and unlinks it from the content. */
  async function removeLike(likeId: string, contentId: string): Promise<void> {
    await pb.collection('users_likes').delete(likeId, { requestKey: null })
    await pb.collection('contents').update(contentId, { 'likes-': likeId }, { requestKey: null })
  }

  return { createLike, removeLike }
}
