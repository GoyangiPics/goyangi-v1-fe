import { describe, expect, it } from 'vite-plus/test'
import { extractXPostLinks, parseXPostUrl } from '~/utils/xLinks'

describe('parseXPostUrl', () => {
  it('reads every host people paste as the same post', () => {
    const want = { id: '1900000000000000001', url: 'https://x.com/nabi/status/1900000000000000001' }
    for (const link of [
      'https://x.com/nabi/status/1900000000000000001',
      'https://twitter.com/nabi/status/1900000000000000001?s=20',
      'https://mobile.twitter.com/nabi/status/1900000000000000001',
      'https://fxtwitter.com/nabi/status/1900000000000000001',
      'https://d.fxtwitter.com/nabi/status/1900000000000000001',
      'https://fixupx.com/nabi/status/1900000000000000001/photo/2',
      'https://vxtwitter.com/nabi/status/1900000000000000001/video/1',
    ]) {
      expect(parseXPostUrl(link), link).toEqual(want)
    }
  })

  it('keeps an /i/ link without a user', () => {
    expect(parseXPostUrl('https://x.com/i/status/1900000000000000001')?.url).toBe(
      'https://x.com/i/status/1900000000000000001',
    )
    expect(parseXPostUrl('https://x.com/i/web/status/1900000000000000001')?.id).toBe(
      '1900000000000000001',
    )
  })

  it("rejects what isn't a post", () => {
    for (const link of [
      'https://x.com/nabi',
      'https://x.com/nabi/status/abc',
      'https://x.com.evil.example/nabi/status/1',
      'https://imgur.com/nabi/status/1',
      'not a link',
    ]) {
      expect(parseXPostUrl(link), link).toBeNull()
    }
  })
})

describe('extractXPostLinks', () => {
  it('finds posts in prose and markdown, once each, in order', () => {
    const text = `first <https://x.com/nabi/status/2> then
      [this](https://twitter.com/nabi/status/1) and again https://fxtwitter.com/nabi/status/2.`
    expect(extractXPostLinks(text).map((p) => p.id)).toEqual(['2', '1'])
  })
})
