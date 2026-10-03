import { describe, expect, it } from 'vitest'
import { renditionCount, renditionUrl } from '~/composables/useDownloadAll'

const hdOnly = { original: 'https://cdn/x.mp4' }
const both = { original: 'https://cdn/y.mp4', sd: 'https://cdn/y-sd.mp4' }
const neither = {}

describe('renditionUrl', () => {
  it('picks the matching rendition', () => {
    expect(renditionUrl(both, 'hd')).toBe('https://cdn/y.mp4')
    expect(renditionUrl(both, 'sd')).toBe('https://cdn/y-sd.mp4')
  })

  it('never substitutes the AV1 file for a missing SD one', () => {
    // The whole reason the SD rendition exists: Safari never software-decodes
    // AV1, so falling back to `original` here would hand the unplayable file to
    // exactly the device that asked for the playable one. Missing has to stay
    // missing so the caller can report it instead.
    expect(renditionUrl(hdOnly, 'sd')).toBeUndefined()
  })

  it('reports missing rather than throwing on a record still encoding', () => {
    expect(renditionUrl(neither, 'hd')).toBeUndefined()
    expect(renditionUrl(neither, 'sd')).toBeUndefined()
  })
})

describe('renditionCount', () => {
  it('counts only the items that can supply the rendition', () => {
    const items = [both, hdOnly, neither, both]
    expect(renditionCount(items, 'hd')).toBe(3)
    expect(renditionCount(items, 'sd')).toBe(2)
  })

  it('is zero for an empty list, which is what hides the SD choice', () => {
    expect(renditionCount([], 'hd')).toBe(0)
    expect(renditionCount([], 'sd')).toBe(0)
  })

  it('is zero when nothing has an SD rendition — a set predating it', () => {
    expect(renditionCount([hdOnly, hdOnly], 'sd')).toBe(0)
    expect(renditionCount([hdOnly, hdOnly], 'hd')).toBe(2)
  })
})
