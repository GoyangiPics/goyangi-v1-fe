import type { Group, Idol } from '~/types/appTypes'
import { describe, expect, it } from 'vite-plus/test'
import {
  collapseIdolSelection,
  idolDisplayName,
  idolQueryToken,
  resolveIdolToken,
} from '~/utils/idolSelection'

const groups = [
  { id: 'g-ive', name: 'IVE' },
  { id: 'g-lsf', name: 'LE SSERAFIM' },
  { id: 'g-izo', name: 'IZ*ONE' },
] as unknown as Group[]

/**
 * Three Chaewons, which is the real situation this module exists for, plus a
 * unique name and one idol with no group at all.
 */
const idols = [
  { id: 'i-cw-lsf', name: 'Chaewon', group: 'g-lsf' },
  // Keeps LE SSERAFIM from being "fully selected" by one Chaewon, so the
  // partial-selection case below actually exercises an idol chip.
  { id: 'i-sakura', name: 'Sakura', group: 'g-lsf' },
  { id: 'i-cw-izo', name: 'Chaewon', group: 'g-izo' },
  { id: 'i-cw-none', name: 'Chaewon', group: '' },
  { id: 'i-yujin', name: 'Yujin', group: 'g-ive' },
  { id: 'i-wony', name: 'Wonyoung', group: 'g-ive' },
] as unknown as Idol[]

const byId = (id: string) => idols.find((i) => i.id === id)!

describe('idolDisplayName', () => {
  it('leaves a unique name bare', () => {
    expect(idolDisplayName(byId('i-yujin'), idols, groups)).toBe('Yujin')
  })

  it('qualifies a shared name with its group', () => {
    expect(idolDisplayName(byId('i-cw-lsf'), idols, groups)).toBe('Chaewon · LE SSERAFIM')
    expect(idolDisplayName(byId('i-cw-izo'), idols, groups)).toBe('Chaewon · IZ*ONE')
  })

  it('falls back to the bare name when there is no group to qualify with', () => {
    expect(idolDisplayName(byId('i-cw-none'), idols, groups)).toBe('Chaewon')
  })
})

describe('idolQueryToken', () => {
  it('leaves a unique name bare, so most shared links are unchanged', () => {
    expect(idolQueryToken(byId('i-wony'), idols, groups)).toBe('Wonyoung')
  })

  it('qualifies a shared name', () => {
    expect(idolQueryToken(byId('i-cw-lsf'), idols, groups)).toBe('Chaewon~LE SSERAFIM')
  })
})

describe('resolveIdolToken', () => {
  it('round-trips every idol back to itself', () => {
    for (const idol of idols) {
      const token = idolQueryToken(idol, idols, groups)
      const resolved = resolveIdolToken(token, idols, groups)
      // The groupless Chaewon cannot be qualified, so it is the one case that
      // legitimately resolves to a different record with the same name.
      if (idol.id === 'i-cw-none') expect(resolved?.name).toBe('Chaewon')
      else expect(resolved?.id).toBe(idol.id)
    }
  })

  it('still resolves a bare name, for links shared before qualifiers existed', () => {
    expect(resolveIdolToken('Chaewon', idols, groups)?.name).toBe('Chaewon')
    expect(resolveIdolToken('Yujin', idols, groups)?.id).toBe('i-yujin')
  })

  it('returns undefined for a name nobody carries', () => {
    expect(resolveIdolToken('Nobody', idols, groups)).toBeUndefined()
  })

  it('falls back to the name when the qualifying group is unknown', () => {
    expect(resolveIdolToken('Yujin~DEFUNCT', idols, groups)?.id).toBe('i-yujin')
  })
})

describe('collapseIdolSelection', () => {
  it('collapses a fully-selected group to one chip', () => {
    const chips = collapseIdolSelection([byId('i-yujin'), byId('i-wony')], idols, groups)
    expect(chips).toHaveLength(1)
    expect(chips[0]).toMatchObject({ label: 'IVE', groupId: 'g-ive' })
  })

  it('qualifies the label of a partially-selected shared name', () => {
    const chips = collapseIdolSelection([byId('i-cw-lsf')], idols, groups)
    expect(chips[0]?.label).toBe('Chaewon · LE SSERAFIM')
    expect(chips[0]?.idol?.id).toBe('i-cw-lsf')
  })
})
