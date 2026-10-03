import type { Uploader } from '~/types/appTypes'

/**
 * Helpers for building PocketBase avatar URLs (100×100 thumbs).
 * Returns null when there's no avatar to display.
 */
export function useAvatarUrl() {
  const pb = usePocketBase()

  function forUser(
    user:
      | { id: string; avatar?: string; collectionId: string; collectionName: string }
      | null
      | undefined,
  ): string | null {
    if (!user?.avatar) return null
    return pb.files.getURL(user, user.avatar, { thumb: '100x100' })
  }

  function forUploader(
    uploader:
      | Uploader
      | {
          expand?: {
            user?: { avatar?: string; id: string; collectionId: string; collectionName: string }
          }
        }
      | null
      | undefined,
  ): string | null {
    const userRecord = (uploader as any)?.expand?.user
    return forUser(userRecord)
  }

  return { forUser, forUploader }
}
