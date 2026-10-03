import { describe, expect, it } from 'vitest'
import { extractImgurLinks, normalizeImgurUrl } from '~/utils/imgurLinks'

/**
 * The FE half of the imgur-parsing problem; bot/links_test.go covers the Go
 * half. The FE can't resolve albums (no Imgur API client id), so where the bot
 * fetches an album's OpenGraph tags, these expect the shortened album URL.
 */
describe('normalizeImgurUrl', () => {
  it('maps bare page links to the playable mp4', () => {
    expect(normalizeImgurUrl('https://imgur.com/AbCd123')).toBe('https://i.imgur.com/AbCd123.mp4')
  })

  it('strips the descriptive slug — the hash is the last hyphen token', () => {
    // Titled posts share as slug-then-hash; ids never contain hyphens. Matching
    // only up to the first hyphen built i.imgur.com/kwon.mp4, which redirects
    // forever (same bug bot/links.go fixed).
    expect(normalizeImgurUrl('https://imgur.com/kwon-eunbi-AbCd123')).toBe(
      'https://i.imgur.com/AbCd123.mp4',
    )
  })

  it('maps .gif to .mp4 too — the upload page no longer takes the legacy container', () => {
    expect(normalizeImgurUrl('https://i.imgur.com/AbCd123.gif')).toBe(
      'https://i.imgur.com/AbCd123.mp4',
    )
  })

  it('maps .gifv to .mp4 (imgur serves gif content as video)', () => {
    expect(normalizeImgurUrl('https://i.imgur.com/AbCd123.gifv')).toBe(
      'https://i.imgur.com/AbCd123.mp4',
    )
  })

  it('preserves image extensions, lowercased', () => {
    expect(normalizeImgurUrl('https://i.imgur.com/AbCd123.jpg')).toBe(
      'https://i.imgur.com/AbCd123.jpg',
    )
    expect(normalizeImgurUrl('https://i.imgur.com/AbCd123.PNG')).toBe(
      'https://i.imgur.com/AbCd123.png',
    )
  })

  it('drops query strings via the URL pathname', () => {
    expect(normalizeImgurUrl('https://i.imgur.com/AbCd123.jpg?fbplay')).toBe(
      'https://i.imgur.com/AbCd123.jpg',
    )
  })

  it('shortens albums and galleries instead of guessing a file', () => {
    // The album hash and the image hash are unrelated; only the Imgur API can
    // resolve one to the other, so the FE keeps the album URL, de-slugged.
    expect(normalizeImgurUrl('https://imgur.com/a/kwon-eunbi-AbCd123')).toBe(
      'https://imgur.com/a/AbCd123',
    )
    expect(normalizeImgurUrl('https://imgur.com/gallery/xYz9876')).toBe(
      'https://imgur.com/gallery/xYz9876',
    )
  })

  it('sheds trailing prose punctuation', () => {
    expect(normalizeImgurUrl('https://i.imgur.com/AbCd123.jpg,')).toBe(
      'https://i.imgur.com/AbCd123.jpg',
    )
    expect(normalizeImgurUrl('https://imgur.com/AbCd123...')).toBe(
      'https://i.imgur.com/AbCd123.mp4',
    )
  })

  it('returns null for input it cannot make sense of', () => {
    expect(normalizeImgurUrl('not a url')).toBeNull()
    expect(normalizeImgurUrl('https://imgur.com/')).toBeNull()
    // All slug, no hash — everything before the last hyphen is stripped, so
    // a trailing hyphen leaves nothing addressable.
    expect(normalizeImgurUrl('https://imgur.com/a/kwon-eunbi-')).toBeNull()
  })
})

describe('extractImgurLinks', () => {
  it('finds links inside prose, markdown and angle brackets', () => {
    const text = [
      'look: https://imgur.com/AbCd123 🐱',
      '[markdown](https://i.imgur.com/xYz9876.jpg)',
      '<https://imgur.com/a/qRs4567>',
    ].join('\n')
    expect(extractImgurLinks(text)).toEqual([
      'https://i.imgur.com/AbCd123.mp4',
      'https://i.imgur.com/xYz9876.jpg',
      'https://imgur.com/a/qRs4567',
    ])
  })

  it('de-duplicates after normalization, not before', () => {
    // Three spellings of the same media collapse to one link.
    const text =
      'https://imgur.com/AbCd123 https://i.imgur.com/AbCd123.gifv https://i.imgur.com/AbCd123.mp4'
    expect(extractImgurLinks(text)).toEqual(['https://i.imgur.com/AbCd123.mp4'])
  })

  it('ignores non-imgur hosts entirely', () => {
    expect(extractImgurLinks('https://files.catbox.moe/abc.mp4 and nothing else')).toEqual([])
  })
})
