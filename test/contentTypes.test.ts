import { describe, expect, it } from 'vite-plus/test'
import { contentTypes, relabelFiletypes } from '~/utils/contentTypes'

describe('contentTypes', () => {
  // The bug this pins: "Gifs" filtered `video`, so the option returned a few
  // videos and no gifs.
  it('maps each label to the filetype it names', () => {
    const byLabel = Object.fromEntries(contentTypes.map((c) => [c.option, c.value]))
    expect(byLabel).toEqual({ Gifs: 'gif', Pics: 'image', Videos: 'video' })
  })

  it('offers no sticker option — a pipeline, not a browse category', () => {
    expect(contentTypes.some((c) => c.value === 'sticker')).toBe(false)
  })
})

describe('relabelFiletypes', () => {
  it('gives a stale persisted "Gifs → video" entry its real name', () => {
    // What a session that used the old filter has in localStorage.
    expect(relabelFiletypes([{ option: 'Gifs', value: 'video' }])).toEqual([
      { option: 'Videos', value: 'video' },
    ])
  })

  it('leaves unknown values alone rather than dropping them', () => {
    const odd = [{ option: 'Whatever', value: 'sticker' }]
    expect(relabelFiletypes(odd)).toEqual(odd)
  })

  it('tolerates a missing list', () => {
    expect(relabelFiletypes(undefined)).toEqual([])
  })
})
