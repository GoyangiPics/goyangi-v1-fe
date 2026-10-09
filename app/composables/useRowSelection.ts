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

  /**
   * Rows seen selected, by key — so a selection can outlive the page it was
   * made on ("select all matching" pulls in rows from every page) and bulk
   * actions still get the full rows. Not reactive itself: `selectedKeys` is.
   */
  const known = new Map<string, T>()
  function remember(row: T) {
    known.set(opts.keyOf(row), row)
  }

  function toggle(row: T) {
    const key = opts.keyOf(row)
    // Reassigned rather than mutated: a Set mutation isn't reactive.
    const next = new Set(selectedKeys.value)
    if (next.has(key)) next.delete(key)
    else {
      next.add(key)
      remember(row)
    }
    selectedKeys.value = next
  }

  /** Page rows in page order, then any selected from elsewhere. */
  const selectedRows = computed(() => {
    const onPage = selectableRows.value.filter(isSelected)
    const pageKeys = new Set(onPage.map(opts.keyOf))
    const elsewhere = [...selectedKeys.value]
      .filter((key) => !pageKeys.has(key))
      .map((key) => known.get(key))
      .filter((row): row is T => !!row && (opts.selectable ? opts.selectable(row) : true))
    return [...onPage, ...elsewhere]
  })

  const allSelected = computed({
    get: () => selectableRows.value.length > 0 && selectableRows.value.every(isSelected),
    set: (value: boolean) => {
      selectableRows.value.forEach(remember)
      selectedKeys.value = value ? new Set(selectableRows.value.map(opts.keyOf)) : new Set()
    },
  })

  /** Add these rows (e.g. every match, across pages) to the selection. */
  function selectRows(more: T[]) {
    const next = new Set(selectedKeys.value)
    for (const row of more) {
      if (opts.selectable && !opts.selectable(row)) continue
      remember(row)
      next.add(opts.keyOf(row))
    }
    selectedKeys.value = next
  }

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
    /** The selected rows themselves, for bulk actions. */
    selectedRows,
    selectRows,
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
    /** Drop these keys — e.g. the rows a bulk action finished, leaving its failures selected. */
    deselect: (keys: Iterable<string>) => {
      const next = new Set(selectedKeys.value)
      for (const key of keys) next.delete(key)
      selectedKeys.value = next
    },
  }
}
