import { describe, expect, it } from 'vitest'
import { hintFiletype } from '~/utils/uploadPlan'

/**
 * The hint the upload page sends, now that pics and gifs share a tab. It only
 * has to be right for the unambiguous containers — the server reclassifies
 * `image`/`gif` from a frame count, which is the only way to tell an animated
 * WebP or AVIF from a still one.
 */
describe('hintFiletype', () => {
  it('calls a video container an animation', () => {
    expect(hintFiletype('clip.mp4', 'video/mp4', 'media')).toBe('gif')
    expect(hintFiletype('clip.webm', 'video/webm', 'media')).toBe('gif')
    expect(hintFiletype('clip.mkv', 'video/x-matroska', 'media')).toBe('gif')
  })

  it('falls back to the extension when the browser reports no mime', () => {
    // .mkv and .mov often arrive with an empty `type`.
    expect(hintFiletype('clip.mkv', '', 'media')).toBe('gif')
    expect(hintFiletype('clip.MOV', '', 'media')).toBe('gif')
  })

  it('calls an image mime a still, including the ambiguous ones', () => {
    expect(hintFiletype('pic.jpg', 'image/jpeg', 'media')).toBe('image')
    // A hint only: the server may turn these into `gif` after counting frames.
    expect(hintFiletype('anim.webp', 'image/webp', 'media')).toBe('image')
    expect(hintFiletype('anim.avif', 'image/avif', 'media')).toBe('image')
  })

  it('passes the deliberate tabs straight through', () => {
    // Keep-audio and square-crop are choices the person made, not facts about
    // the container.
    expect(hintFiletype('clip.mp4', 'video/mp4', 'video')).toBe('video')
    expect(hintFiletype('clip.mp4', 'video/mp4', 'sticker')).toBe('sticker')
  })
})
