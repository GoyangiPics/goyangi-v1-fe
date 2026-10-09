import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useRowSelection } from '~/composables/useRowSelection'

interface Row {
  id: string
  status?: string
  preview?: string
  sd?: string
  hd?: string
}

/** One link-triple per row — the shape a content listing uses. */
function simple(rows: Row[] | ReturnType<typeof ref<Row[]>>, opts: { reverse?: boolean } = {}) {
  return useRowSelection<Row>(rows as any, {
    keyOf: (r) => r.id,
    linksOf: (r) => [{ preview: r.preview, sd: r.sd, hd: r.hd }],
    ...opts,
  })
}

const rowsFixture: Row[] = [
  { id: 'a', preview: 'a.avif', sd: 'a-sd.mp4', hd: 'a.mp4' },
  { id: 'b', preview: 'b.avif', hd: 'b.mp4' },
  { id: 'c' },
]

describe('useRowSelection', () => {
  it('starts empty', () => {
    const s = simple(rowsFixture)
    expect(s.selectedCount.value).toBe(0)
    expect(s.allSelected.value).toBe(false)
    expect(s.someSelected.value).toBe(false)
  })

  it('toggles a row on and off', () => {
    const s = simple(rowsFixture)
    s.toggle(rowsFixture[0]!)
    expect(s.isSelected(rowsFixture[0]!)).toBe(true)
    expect(s.selectedCount.value).toBe(1)
    s.toggle(rowsFixture[0]!)
    expect(s.isSelected(rowsFixture[0]!)).toBe(false)
  })

  it('reports someSelected only for a partial selection', () => {
    const s = simple(rowsFixture)
    s.toggle(rowsFixture[0]!)
    expect(s.someSelected.value).toBe(true)
    expect(s.allSelected.value).toBe(false)

    s.allSelected.value = true
    expect(s.someSelected.value).toBe(false)
    expect(s.allSelected.value).toBe(true)
  })

  it('select-all then clear round-trips', () => {
    const s = simple(rowsFixture)
    s.allSelected.value = true
    expect(s.selectedCount.value).toBe(3)
    s.clear()
    expect(s.selectedCount.value).toBe(0)
  })

  it('collects only the links that exist, per rendition', () => {
    const s = simple(rowsFixture)
    s.allSelected.value = true
    expect(s.previewUrls.value).toEqual(['a.avif', 'b.avif'])
    // Only row a has an sd rendition — b and c contribute nothing.
    expect(s.sdUrls.value).toEqual(['a-sd.mp4'])
    expect(s.hdUrls.value).toEqual(['a.mp4', 'b.mp4'])
  })

  it('collects in display order by default, reversed only on request', () => {
    const forward = simple(rowsFixture)
    forward.allSelected.value = true
    expect(forward.hdUrls.value).toEqual(['a.mp4', 'b.mp4'])

    const reversed = simple(rowsFixture, { reverse: true })
    reversed.allSelected.value = true
    expect(reversed.hdUrls.value).toEqual(['b.mp4', 'a.mp4'])
  })

  it('excludes unselectable rows from select-all and from counts', () => {
    const s = useRowSelection<Row>(rowsFixture, {
      keyOf: (r) => r.id,
      linksOf: (r) => [{ hd: r.hd }],
      selectable: (r) => r.status !== 'pending',
    })
    expect(s.selectableCount.value).toBe(3)

    const withPending = useRowSelection<Row>(
      [...rowsFixture, { id: 'd', status: 'pending', hd: 'd.mp4' }],
      {
        keyOf: (r) => r.id,
        linksOf: (r) => [{ hd: r.hd }],
        selectable: (r) => r.status !== 'pending',
      },
    )
    withPending.allSelected.value = true
    expect(withPending.selectableCount.value).toBe(3)
    expect(withPending.hdUrls.value).not.toContain('d.mp4')
  })

  it('survives rows being replaced wholesale, as a refetch does', () => {
    // The reason selection is keyed by id rather than a flag on the row: every
    // fetchItems replaces the record objects, and a row-local `selected` would
    // be lost each time.
    const rows = ref<Row[]>([{ id: 'a', hd: 'a.mp4' }])
    const s = simple(rows)
    s.toggle(rows.value[0]!)
    expect(s.selectedCount.value).toBe(1)

    // Same ids, brand-new objects.
    rows.value = [{ id: 'a', hd: 'a-new.mp4' }]
    expect(s.selectedCount.value).toBe(1)
    expect(s.hdUrls.value).toEqual(['a-new.mp4'])
  })

  it('handles a row contributing many link-triples, as a set row does', () => {
    const sets = [
      { id: 's1', clips: [{ hd: 'x.mp4' }, { hd: 'y.mp4' }] },
      { id: 's2', clips: [{ hd: 'z.mp4' }] },
    ]
    const s = useRowSelection<(typeof sets)[number]>(sets, {
      keyOf: (r) => r.id,
      linksOf: (r) => r.clips.map((c) => ({ hd: c.hd })),
    })
    s.allSelected.value = true
    expect(s.hdUrls.value).toEqual(['x.mp4', 'y.mp4', 'z.mp4'])
    // Two rows selected, three links — the counts measure different things.
    expect(s.selectedCount.value).toBe(2)
  })
})

describe('useRowSelection across pages', () => {
  it('keeps rows selected from elsewhere, after the page ones', () => {
    const page = ref([{ id: 'a' }, { id: 'b' }])
    const s = useRowSelection(page, { keyOf: (r: { id: string }) => r.id, linksOf: () => [] })
    s.selectRows([{ id: 'z' }, { id: 'a' }])
    s.toggle({ id: 'b' })
    expect(s.selectedRows.value.map((r) => r.id)).toEqual(['a', 'b', 'z'])

    page.value = [{ id: 'c' }]
    expect(s.selectedRows.value.map((r) => r.id).toSorted()).toEqual(['a', 'b', 'z'])
    s.deselect(['a', 'z'])
    expect(s.selectedRows.value.map((r) => r.id)).toEqual(['b'])
  })
})
