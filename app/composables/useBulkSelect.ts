import type { MaybeRefOrGetter } from 'vue'
import type { RowLinks } from '~/composables/useRowSelection'
import { ref, watch } from 'vue'

interface BulkSelectOptions<T> {
  /** Links a row contributes to the copy buttons (list layouts). */
  links?: (row: T) => RowLinks[]
  /** Everything the listing matches, across pages, for "Select all". */
  fetchAll?: () => Promise<T[]>
  /** Refetch after a bulk action changed things. */
  refresh: () => unknown
}

/**
 * Select mode for a listing page: the toggle, the selection (which can span
 * pages), "select all matching", and what to do when a bulk action finishes —
 * drop the rows it handled from the selection, keep the failures, refetch.
 */
export function useBulkSelect<T extends { id: string }>(
  items: MaybeRefOrGetter<T[]>,
  opts: BulkSelectOptions<T>,
) {
  const selecting = ref(false)
  const isSelectingAll = ref(false)

  const selection = useRowSelection(items, {
    keyOf: (row: T) => row.id,
    linksOf: opts.links ?? (() => []),
  })

  watch(selecting, (on) => {
    if (!on) selection.clear()
  })

  function toggleSelecting() {
    selecting.value = !selecting.value
  }

  async function selectAll() {
    if (!opts.fetchAll) return
    isSelectingAll.value = true
    try {
      selection.selectRows(await opts.fetchAll())
    } finally {
      isSelectingAll.value = false
    }
  }

  async function onProcessed(doneIds: string[]) {
    selection.deselect(doneIds)
    await opts.refresh()
  }

  return { selecting, isSelectingAll, selection, toggleSelecting, selectAll, onProcessed }
}
