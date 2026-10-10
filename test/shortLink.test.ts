import { describe, expect, it } from 'vite-plus/test'
import { shortLink, shortLinks } from '~/utils/shortLink'

const ORIGIN = 'https://goyangi.pics'
const CDN = 'https://cdn.goyangi.pics/v1/aespa/winter/250628-aespa-winter-1831'

const gif = {
  id: '250628-aespa-winter-3a621831',
  preview: `${CDN}.webp`,
  original: `${CDN}.mp4`,
  sd: `${CDN}-sd.mp4`,
}
const image = { id: '260724-ive-yujin-bb0638e5', preview: `${CDN}.avif`, original: `${CDN}.avif` }

describe('shortLink', () => {
  it('carries the preview object’s own extension', () => {
    expect(shortLink(gif, 'preview', ORIGIN)).toBe(
      'https://goyangi.pics/v/250628-aespa-winter-3a621831.webp',
    )
    expect(shortLink(image, 'preview', ORIGIN)).toBe(
      'https://goyangi.pics/v/260724-ive-yujin-bb0638e5.avif',
    )
  })

  it('names the video renditions by extension, SD with its marker', () => {
    expect(shortLink(gif, 'hd', ORIGIN)).toBe(
      'https://goyangi.pics/v/250628-aespa-winter-3a621831.mp4',
    )
    expect(shortLink(gif, 'sd', ORIGIN)).toBe(
      'https://goyangi.pics/v/250628-aespa-winter-3a621831-sd.mp4',
    )
  })

  // An image's original and preview are both .avif, so the extension alone
  // cannot say which one is meant.
  it('marks an image original, whose extension collides with its preview', () => {
    expect(shortLink(image, 'hd', ORIGIN)).toBe(
      'https://goyangi.pics/v/260724-ive-yujin-bb0638e5-hd.avif',
    )
  })

  it('is null for a rendition the record lacks', () => {
    expect(shortLink(image, 'sd', ORIGIN)).toBeNull()
    expect(shortLink({ id: 'x' }, 'preview', ORIGIN)).toBeNull()
  })

  it('tolerates a trailing slash on the origin', () => {
    expect(shortLink(gif, 'hd', 'https://dev.goyangi.pics/')).toBe(
      'https://dev.goyangi.pics/v/250628-aespa-winter-3a621831.mp4',
    )
  })

  // No window in the node test environment, so this exercises the fallback.
  it('falls back to the canonical host without a window', () => {
    expect(shortLink(gif, 'hd')).toBe('https://goyangi.pics/v/250628-aespa-winter-3a621831.mp4')
  })
})

describe('shortLinks', () => {
  it('offers only the renditions the record has', () => {
    expect(shortLinks({ ...gif, sd: undefined }, ORIGIN)).toEqual({
      preview: 'https://goyangi.pics/v/250628-aespa-winter-3a621831.webp',
      hd: 'https://goyangi.pics/v/250628-aespa-winter-3a621831.mp4',
      sd: undefined,
    })
  })

  it('offers nothing for a record still encoding', () => {
    expect(shortLinks({ id: 'x' }, ORIGIN)).toEqual({
      preview: undefined,
      hd: undefined,
      sd: undefined,
    })
  })
})
