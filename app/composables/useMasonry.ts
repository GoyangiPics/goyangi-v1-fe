import type { Ref } from 'vue'
import { computed } from 'vue'

export function useMasonry<T>(items: Ref<T[]>, columnCount: Ref<number>) {
  const columns = computed(() => {
    // Create N empty arrays
    const cols = Array.from({ length: columnCount.value }, () => [] as T[])

    // Distribute items round-robin: item 0 -> col 0, item 1 -> col 1, ...
    items.value.forEach((item, index) => {
      cols[index % columnCount.value]!.push(item)
    })

    return cols
  })

  return { columns }
}
