import type { ContentFormat } from '~/types/typesSettings'

/** Which stored rendition a `<video>` plays. */
export type RenditionMode = 'hd' | 'sd' | 'preview'

/**
 * Where the media is being shown.
 *
 * `grid`: a card in a listing, a few hundred pixels wide, one of many playing
 * at once. `viewer`: fullscreen, the single page, the slideshow — one item,
 * shown large.
 */
export type RenditionSurface = 'grid' | 'viewer'

export interface RenditionInput {
  /** The user's "Playback Quality" setting. */
  format: ContentFormat
  /** `useAv1Support` — null while undetermined, which is treated as supported. */
  av1Supported: boolean | null
  /** Whether the record has an H.264 rendition (records predating it don't). */
  hasSd: boolean
  surface: RenditionSurface
}

/**
 * Resolves the rendition to play from the setting, the device and the surface.
 *
 * The setting is a ceiling, not a mandate. `HD MP4 (AV1)` means HD *where it can
 * be seen*: the viewer surfaces. A grid card plays the SD rendition regardless,
 * because a 1080×1920 AV1 stream decoded into a 300px-wide card is pure waste —
 * a page of them saturates the GPU's video decoder and every gif on screen
 * stutters. `SD MP4 (H264)` and `LD WebP` already ask for less than the grid
 * cap, so they behave the same on both surfaces.
 *
 * A record with no `sd` object keeps playing HD in the grid rather than falling
 * to the preview image, exactly as it did before the cap existed.
 */
export function resolveRenditionMode(input: RenditionInput): RenditionMode {
  const { format, av1Supported, hasSd, surface } = input
  switch (format) {
    case 'LD WebP':
      return 'preview'
    case 'SD MP4 (H264)':
      return hasSd ? 'sd' : 'hd'
    default:
      // A device proven unable to decode AV1 gets real video with audio and
      // controls (H.264) rather than a looping picture; only a record that
      // predates the H.264 rendition falls to the preview.
      if (av1Supported === false) return hasSd ? 'sd' : 'preview'
      if (surface === 'grid') return hasSd ? 'sd' : 'hd'
      return 'hd'
  }
}
