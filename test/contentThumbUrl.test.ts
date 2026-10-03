import { describe, expect, it } from 'vitest'
import { contentThumbUrl } from '~/utils/contentThumbUrl'

describe('contentThumbUrl', () => {
  it('prefers the static poster', () => {
    expect(contentThumbUrl({ static: 's.avif', preview: 'p.avif', original: 'o.avif' })).toBe(
      's.avif',
    )
  })

  it('falls back to preview when it is a decodable image', () => {
    for (const ext of ['avif', 'webp', 'png', 'jpg', 'jpeg', 'JPG']) {
      expect(contentThumbUrl({ preview: `p.${ext}` })).toBe(`p.${ext}`)
    }
  })

  it('does NOT use an mp4 preview', () => {
    // This is the bug it exists for. A gif's `original` (and its `preview`, when
    // the animated encode failed and fell back to the mp4 URL) is an AV1 mp4,
    // which an <img> cannot decode — the merge dialog rendered blank tiles.
    expect(contentThumbUrl({ preview: 'p.mp4', filetype: 'gif' })).toBe('')
    expect(contentThumbUrl({ original: 'o.mp4', filetype: 'gif' })).toBe('')
    expect(contentThumbUrl({ original: 'o.mp4', filetype: 'video' })).toBe('')
  })

  it('falls back to original for stills and stickers', () => {
    // static is best-effort on the backend and stickers never get one, so
    // static-only would still leave blank tiles.
    expect(contentThumbUrl({ original: 'o.avif', filetype: 'image' })).toBe('o.avif')
    expect(contentThumbUrl({ original: 'o.avif', filetype: 'sticker' })).toBe('o.avif')
  })

  it('returns empty when nothing is decodable, so callers can show their own placeholder', () => {
    expect(contentThumbUrl({})).toBe('')
    expect(contentThumbUrl(null)).toBe('')
    expect(contentThumbUrl(undefined)).toBe('')
  })

  it('ignores an extension appearing mid-path rather than at the end', () => {
    expect(contentThumbUrl({ preview: '/avif/thing.mp4', filetype: 'gif' })).toBe('')
  })
})
