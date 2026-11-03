import { describe, expect, it } from 'vite-plus/test'
import { readXPost, xFilename, xItemKey } from '~/utils/xMedia'
import fixtures from './fixtures/fxtwitter.json'

// Recorded FxTwitter answers, anonymised: real shapes, placeholder ids and
// handle.
describe('readXPost', () => {
  it('lists a video with its mp4 renditions best first, skipping the HLS one', () => {
    const post = readXPost(fixtures.video)
    if (typeof post === 'string') throw new Error(post)
    expect(post.media).toHaveLength(1)
    const [video] = post.media
    expect(video!.kind).toBe('video')
    expect(video!.mime).toBe('video/mp4')
    expect(video!.candidates[0]).toContain('2152x2160')
    expect(video!.candidates.every((u) => u.includes('.mp4'))).toBe(true)
    expect(new Set(video!.candidates).size).toBe(video!.candidates.length)
  })

  it('takes photos at their original size', () => {
    const post = readXPost(fixtures.photos)
    if (typeof post === 'string') throw new Error(post)
    expect(post.media.map((m) => m.kind)).toEqual(['photo', 'photo'])
    expect(post.media.every((m) => m.candidates[0]!.includes('name=orig'))).toBe(true)
    expect(post.media[0]!.mime).toBe('image/jpeg')
  })

  it('keeps a mixed post in its own order', () => {
    const post = readXPost(fixtures.mixed)
    if (typeof post === 'string') throw new Error(post)
    expect(post.media.map((m) => m.kind)).toEqual(['photo', 'photo', 'video'])
  })

  it('carries the post link, author and date', () => {
    const post = readXPost(fixtures.photos)
    if (typeof post === 'string') throw new Error(post)
    expect(post.url).toBe('https://x.com/nabi/status/1900000000000000002')
    expect(post.author).toBe('nabi')
    expect(post.postedAt?.getTime()).toBe(fixtures.photos.tweet.created_timestamp * 1000)
  })

  it('says why a post gave nothing', () => {
    expect(readXPost({ code: 404, message: 'NOT_FOUND', tweet: null })).toBe('dead')
    expect(readXPost({ code: 401, message: 'PRIVATE_TWEET', tweet: null })).toBe('private')
    // A malformed id gets an HTML page with a 200, which never parses as JSON.
    expect(readXPost(null)).toBe('dead')
    expect(readXPost({ code: 200, tweet: { id: '1', media: { all: [] } } })).toBe('noMedia')
  })
})

describe('xFilename', () => {
  it('names a file after its post and position', () => {
    expect(xFilename('1900000000000000002', 0, 'image/jpeg')).toBe('x-1900000000000000002-1.jpg')
    expect(xFilename('1900000000000000001', 2, 'video/mp4')).toBe('x-1900000000000000001-3.mp4')
  })
})

describe('xItemKey', () => {
  it('is per post and position', () => {
    expect(xItemKey('7', 0)).not.toBe(xItemKey('7', 1))
  })
})
