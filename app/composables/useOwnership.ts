import type { Viewer } from '~/utils/ownership'
import { computed } from 'vue'
import { canManagePost, canManageSet } from '~/utils/ownership'

/** The signed-in viewer's management rights; see utils/ownership. */
export function useOwnership() {
  const authStore = useAuthStore()
  const pb = usePocketBase()

  const viewer = computed<Viewer>(() => ({
    isAdmin: !!authStore.isAdmin,
    uploaderId: authStore.uploader?.id ?? null,
  }))

  /**
   * How many posts a set has, and how many are the viewer's. A count query
   * rather than the `contents_via_set` expand, which PocketBase caps at 1000.
   */
  async function setPostCounts(setId: string) {
    const [all, mine] = await Promise.all([
      pb.collection('contents').getList(1, 1, {
        filter: pb.filter('set = {:id}', { id: setId }),
        fields: 'id',
        requestKey: null,
      }),
      viewer.value.uploaderId
        ? pb.collection('contents').getList(1, 1, {
            filter: pb.filter('set = {:id} && uploader = {:up}', {
              id: setId,
              up: viewer.value.uploaderId,
            }),
            fields: 'id',
            requestKey: null,
          })
        : Promise.resolve({ totalItems: 0 }),
    ])
    return { total: all.totalItems, mine: mine.totalItems }
  }

  return {
    viewer,
    canManagePost: (post: Parameters<typeof canManagePost>[0]) => canManagePost(post, viewer.value),
    canManageSet: (set: Parameters<typeof canManageSet>[0]) => canManageSet(set, viewer.value),
    setPostCounts,
  }
}
