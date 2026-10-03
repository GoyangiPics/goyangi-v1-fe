import type { ContentsItem } from '~/types/appTypes'
import { ref } from 'vue'

export function useFetchItem(itemId: string | string[]) {
  const pb = usePocketBase()
  const id = Array.isArray(itemId) ? itemId[0] || '' : itemId

  const item = ref<ContentsItem | null>(null)
  const isLoading = ref(true)

  async function fetchItem() {
    isLoading.value = true
    try {
      item.value = await pb.collection('contents').getOne<ContentsItem>(id, {
        // `labels` included so the detail page's chip row shows them, same as a
        // card's — CardChips reads expand.labels and renders nothing without it.
        expand: 'idol,group,uploader,uploader.user,tag,labels,set,collections,likes',
      })
    } catch (error) {
      console.error('[useFetchItem] fetch error:', error)
      item.value = null
    } finally {
      isLoading.value = false
    }
  }

  return {
    item,
    fetchItem,
    isLoading,
  }
}
