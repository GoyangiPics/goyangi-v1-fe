import { describe, expect, it } from 'vite-plus/test'
import {
  extensionForMime,
  imgurFilename,
  isAcceptedByFilter,
  isMediaMime,
  isRemovedPlaceholder,
  normalizeMime,
  stillFallbackUrl,
} from '~/utils/imgurFetch'

const GIF_ACCEPT =
  'image/gif,video/mp4,video/webm,video/x-matroska,video/quicktime,.gif,.mp4,.webm,.mkv,.mov'
const PICS_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif'

/**
 * The whole point of these: imgur answers 200 for content that is gone. Every
 * check here is what stops a batch of dead links being uploaded as 503-byte
 * grey placeholders.
 */
describe('isRemovedPlaceholder', () => {
  it('recognises the tombstone a dead image link redirects to', () => {
    expect(isRemovedPlaceholder('https://i.imgur.com/removed.png')).toBe(true)
  })

  it('is case-insensitive on the path', () => {
    expect(isRemovedPlaceholder('https://i.imgur.com/REMOVED.PNG')).toBe(true)
  })

  it('does not fire on a live link that merely ends in png', () => {
    expect(isRemovedPlaceholder('https://i.imgur.com/AbCd123.png')).toBe(false)
  })

  it('does not fire on an id that happens to contain the word', () => {
    expect(isRemovedPlaceholder('https://i.imgur.com/notremoved.png')).toBe(false)
  })

  it('is false rather than throwing on unparseable input', () => {
    expect(isRemovedPlaceholder('not a url')).toBe(false)
  })
})

describe('normalizeMime', () => {
  it('drops parameters and lowercases', () => {
    expect(normalizeMime('Image/PNG; charset=binary')).toBe('image/png')
  })

  it('treats a missing header as empty', () => {
    expect(normalizeMime(null)).toBe('')
  })
})

describe('isMediaMime', () => {
  it('accepts the types imgur actually serves', () => {
    expect(isMediaMime('video/mp4')).toBe(true)
    expect(isMediaMime('image/gif')).toBe(true)
  })

  // The other half of dead-link detection: a dead link requested as .mp4 is
  // 301'd to imgur.com's homepage, which answers with HTML.
  it('rejects the HTML a dead .mp4 link redirects to', () => {
    expect(isMediaMime('text/html')).toBe(false)
  })
})

describe('imgurFilename', () => {
  it('names the file from the id and the SERVED type, not the requested one', () => {
    // A link normalized to .mp4 that comes back as a gif must not be staged as
    // an mp4 — filetype is inferred from the name downstream.
    expect(imgurFilename('https://i.imgur.com/AbCd123.mp4', 'image/gif')).toBe('AbCd123.gif')
  })

  it('handles an extension-less url', () => {
    expect(imgurFilename('https://i.imgur.com/AbCd123', 'video/mp4')).toBe('AbCd123.mp4')
  })

  it('falls back rather than producing a nameless file', () => {
    expect(imgurFilename('not a url', 'image/png')).toBe('imgur.png')
  })

  it('uses .bin for a type it has no extension for', () => {
    expect(extensionForMime('application/pdf')).toBeNull()
    expect(imgurFilename('https://i.imgur.com/AbCd123.mp4', 'application/pdf')).toBe('AbCd123.bin')
  })
})

describe('stillFallbackUrl', () => {
  // normalizeImgurUrl sends every extension-less link to .mp4, which is wrong
  // for stills — and a still requested as .mp4 redirects away rather than
  // serving the image.
  it('retries a guessed .mp4 as .jpg', () => {
    expect(stillFallbackUrl('https://i.imgur.com/AbCd123.mp4')).toBe(
      'https://i.imgur.com/AbCd123.jpg',
    )
  })

  it('has nothing to retry when the extension was explicit', () => {
    expect(stillFallbackUrl('https://i.imgur.com/AbCd123.png')).toBeNull()
  })
})

describe('isAcceptedByFilter', () => {
  it('accepts an imgur mp4 on the GIF tab', () => {
    expect(isAcceptedByFilter('video/mp4', 'AbCd123.mp4', GIF_ACCEPT)).toBe(true)
  })

  // The mismatch worth catching client-side: pasting a video while Pics is the
  // selected type used to be the backend's problem.
  it('rejects an mp4 on the Pics tab', () => {
    expect(isAcceptedByFilter('video/mp4', 'AbCd123.mp4', PICS_ACCEPT)).toBe(false)
  })

  it('matches on extension when the mime is absent from the filter', () => {
    expect(isAcceptedByFilter('video/x-m4v', 'AbCd123.mp4', GIF_ACCEPT)).toBe(true)
  })

  it('supports a wildcard filter', () => {
    expect(isAcceptedByFilter('image/png', 'AbCd123.png', 'image/*')).toBe(true)
    expect(isAcceptedByFilter('video/mp4', 'AbCd123.mp4', 'image/*')).toBe(false)
  })
})
