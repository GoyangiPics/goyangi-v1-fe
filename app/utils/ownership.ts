/**
 * Who may manage a post or set — the client's mirror of the backend rules
 * (goyangi-v1-be hooks/ownership.go), used to decide what to OFFER. The server
 * is the gate; these only keep people from being shown actions that would 403.
 *
 * Pure functions over plain ids, so they test without a store.
 */

export interface Viewer {
  isAdmin: boolean
  /** The signed-in account's uploader record id, if it has one. */
  uploaderId: string | null
}

/** A post is yours when its uploader is. Posts with no uploader are admin-only. */
export function canManagePost(
  post: { uploader?: string | null } | null | undefined,
  viewer: Viewer,
) {
  if (!post) return false
  if (viewer.isAdmin) return true
  return !!viewer.uploaderId && post.uploader === viewer.uploaderId
}

/**
 * You co-own a set when one of its uploaders is you. The backend derives a
 * set's uploaders from its posts, so this is "you have a post in it".
 */
export function canManageSet(
  set: { uploader?: string[] | string | null } | null | undefined,
  viewer: Viewer,
) {
  if (!set) return false
  if (viewer.isAdmin) return true
  const ids = Array.isArray(set.uploader) ? set.uploader : set.uploader ? [set.uploader] : []
  return !!viewer.uploaderId && ids.includes(viewer.uploaderId)
}

/**
 * What deleting a set means for this viewer: the whole set when every post in
 * it is theirs (or they're an admin), otherwise only their own posts — the
 * backend refuses the rest.
 */
export function setDeleteMode(counts: { total: number; mine: number }, viewer: Viewer) {
  if (viewer.isAdmin || counts.mine === counts.total) return 'set' as const
  return counts.mine > 0 ? ('mine' as const) : ('none' as const)
}
