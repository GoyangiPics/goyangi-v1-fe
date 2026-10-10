import type { Group, Idol } from '~/types/appTypes'
import { describe, expect, it } from 'vite-plus/test'
import { ref } from 'vue'
import { useGroupedIdolSelection } from '~/composables/useGroupedIdolSelection'

const groups = [
  { id: 'g_ive', name: 'IVE' },
  { id: 'g_twice', name: 'TWICE' },
] as Group[]

const idol = (id: string, name: string, group: string) => ({ id, name, group }) as unknown as Idol

const idols = [
  idol('i_wonyoung', 'Wonyoung', 'g_ive'),
  idol('i_leeseo', 'Leeseo', 'g_ive'),
  idol('i_nayeon', 'Nayeon', 'g_twice'),
  idol('i_orphan', 'Solo Act', ''),
]

function setup(selected: Array<{ id: string }> = []) {
  const sel = ref(selected)
  const api = useGroupedIdolSelection(
    () => sel.value,
    () => idols,
    () => groups,
  )
  return { ...api, sel }
}

describe('useGroupedIdolSelection', () => {
  it('groups idols under their group, sorted by group then name', () => {
    const { groupedIdols } = setup()
    expect(groupedIdols.value.map((g) => g.label)).toEqual(['IVE', 'Other', 'TWICE'])
    expect(groupedIdols.value[0]!.items.map((i) => i.name)).toEqual(['Leeseo', 'Wonyoung'])
  })

  it('files an idol with no group under Other', () => {
    const { groupedIdols } = setup()
    const other = groupedIdols.value.find((g) => g.label === 'Other')
    expect(other?.items.map((i) => i.name)).toEqual(['Solo Act'])
  })

  it('annotates each idol with its group name, for search and display', () => {
    const { groupedIdols } = setup()
    expect(groupedIdols.value[0]!.items[0]!.groupName).toBe('IVE')
  })

  describe('search', () => {
    it('matches idol names, dropping groups with no survivors', () => {
      const { searchTerm, filteredGroups } = setup()
      searchTerm.value = 'nayeon'
      expect(filteredGroups.value.map((g) => g.label)).toEqual(['TWICE'])
      expect(filteredGroups.value[0]!.items.map((i) => i.name)).toEqual(['Nayeon'])
    })

    it('keeps ALL members when the group name matches', () => {
      // Searching "IVE" should list the group, not filter its members out for
      // failing to contain "ive" themselves.
      const { searchTerm, filteredGroups } = setup()
      searchTerm.value = 'IVE'
      const ive = filteredGroups.value.find((g) => g.label === 'IVE')
      expect(ive?.items.map((i) => i.name)).toEqual(['Leeseo', 'Wonyoung'])
    })

    it('is case-insensitive and ignores surrounding space', () => {
      const { searchTerm, filteredGroups } = setup()
      searchTerm.value = '  WONYOUNG  '
      expect(filteredGroups.value.map((g) => g.label)).toEqual(['IVE'])
    })

    it('returns everything for an empty term', () => {
      const { searchTerm, filteredGroups, groupedIdols } = setup()
      searchTerm.value = ''
      expect(filteredGroups.value).toEqual(groupedIdols.value)
    })

    it('returns nothing when nothing matches', () => {
      const { searchTerm, filteredGroups } = setup()
      searchTerm.value = 'zzzz'
      expect(filteredGroups.value).toEqual([])
    })
  })

  describe('groupCheckState', () => {
    const ive = () => idols.filter((i) => (i as any).group === 'g_ive')

    it('is false when none are selected', () => {
      const { groupCheckState } = setup([])
      expect(groupCheckState(ive())).toBe(false)
    })

    it('is true when all are selected', () => {
      const { groupCheckState } = setup([{ id: 'i_wonyoung' }, { id: 'i_leeseo' }])
      expect(groupCheckState(ive())).toBe(true)
    })

    it('is indeterminate for a partial selection', () => {
      const { groupCheckState } = setup([{ id: 'i_wonyoung' }])
      expect(groupCheckState(ive())).toBe('indeterminate')
    })

    it('ignores selections outside the group being asked about', () => {
      const { groupCheckState } = setup([{ id: 'i_nayeon' }])
      expect(groupCheckState(ive())).toBe(false)
    })

    it('is false for an empty group rather than vacuously true', () => {
      // `every` on an empty array is true, which would render a ticked checkbox
      // for a group with no members.
      const { groupCheckState } = setup([])
      expect(groupCheckState([])).toBe(false)
    })

    it('tracks a changing selection', () => {
      const { groupCheckState, sel } = setup([])
      expect(groupCheckState(ive())).toBe(false)
      sel.value = [{ id: 'i_wonyoung' }, { id: 'i_leeseo' }]
      expect(groupCheckState(ive())).toBe(true)
    })
  })
})
