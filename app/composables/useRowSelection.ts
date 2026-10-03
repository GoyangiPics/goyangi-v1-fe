import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, toValue } from 'vue'

/** The three rendition links a row can contribute. */
export interface RowLinks {
  preview?: string
  sd?: string
  hd?: string
}

interface RowSelectionOptions<T> {
  keyOf: (row: T) => string
  /**
   * A row may contribute several link-triples — a *set* row yields one per clip.
   */
  linksOf: (row: T) => RowLinks[]
  /** Rows that can't contribute (still processing, failed) — excluded from select-all. */
  selectable?: (row: T) => boolean
  /** Reverse the aggregated order. Opt-in; see the note in useCopyLinks. */
  reverse?: boolean
}

/**
 * Checkbox selection over a list of rows, plus the aggregated links for whatever
 * is selected.
 *
 * Extracted from the upload results panel, which was the only select-and-copy UI
 * in the app. Two deliberate differences from that original:
 *
 *  1. Selection lives in a `Set` of ids, not as a `selected` boolean on the row
 *     object. PocketBase records are replaced wholesale on every refetch, so
 *     row-local flags would silently vanish on each `fetchItems`.
 *  2. `reverse` is opt-in. The upload panel reverses because its results grow
 *     downward and the pasted block should read oldest-last; a listing already
 *     sorted `-created` should copy in display order.
 */
export function useRowSelection<T>(rows: MaybeRefOrGetter<T[]>, opts: RowSelectionOptions<T>) {
  const selectedKeys = ref<Set<string>>(new Set())

  const selectableRows = computed(() =>
    toValue(rows).filter((row) => (opts.selectable ? opts.selectable(row) : true)),
  )

  function isSelected(row: T) {
    return selectedKeys.value.has(opts.keyOf(row))
  }

  function toggle(row: T) {
    const key = opts.keyOf(row)
    // Reassigned rather than mutated: a Set mutation isn't reactive.
    const next = new Set(selectedKeys.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    selectedKeys.value = next
  }

  const selectedRows = computed(() => selectableRows.value.filter(isSelected))

  const allSelected = computed({
    get: () => selectableRows.value.length > 0 && selectableRows.value.every(isSelected),
    set: (value: boolean) => {
      selectedKeys.value = value ? new Set(selectableRows.value.map(opts.keyOf)) : new Set()
    },
  })

  const someSelected = computed(() => selectedRows.value.length > 0 && !allSelected.value)

  function collect(field: keyof RowLinks) {
    const urls = selectedRows.value.flatMap((row) =>
      opts
        .linksOf(row)
        .map((links) => links[field])
        .filter((u): u is string => !!u),
    )
    return opts.reverse ? urls.toReversed() : urls
  }

  return {
    selectedKeys,
    isSelected,
    toggle,
    allSelected,
    someSelected,
    selectedCount: computed(() => selectedRows.value.length),
    selectableCount: computed(() => selectableRows.value.length),
    previewUrls: computed(() => collect('preview')),
    sdUrls: computed(() => collect('sd')),
    hdUrls: computed(() => collect('hd')),
    clear: () => {
      selectedKeys.value = new Set()
    },
  }
}
