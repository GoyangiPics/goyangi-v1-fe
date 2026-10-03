import type { MaybeRefOrGetter } from 'vue'
import type { ContentsItem } from '~/types/appTypes'
import type { RenditionMode, RenditionSurface } from '~/utils/rendition'
import { computed, toValue } from 'vue'

/**
 * Codecs-qualified MIME types for the two video renditions the backend stores.
 *
 * These go on `<source type>` so a browser can reject a rendition it can't
 * decode and fall through to the next one. Treat that as a bonus, not the
 * mechanism: Safari reports "probably" for AV1 even on hardware with no AV1
 * decoder, so on the exact devices this matters for, type-based rejection
 * doesn't fire. `useAv1Support` (MediaCapabilities) is what actually decides.
 *
 * Video codecs only, deliberately. Gifs ship with audio stripped and videos
 * carry AAC, so naming an audio codec here would be wrong for half the library
 * — and browsers don't require every track to be listed.
 */
export const AV1_MIME = 'video/mp4; codecs="av01.0.08M.10"'
export const H264_MIME = 'video/mp4; codecs="avc1.640028"'

export interface VideoSource {
  src: string
  type: string
}

/**
 * Resolves which stored rendition a given content item should play, honoring
 * the user's `contentFormat` setting, this device's AV1 capability and the
 * surface it plays on (grid cards cap at SD — see resolveRenditionMode).
 *
 * Shared by every surface that renders content media (cards, fullscreen,
 * single page, slideshow) so they can't drift apart on which URL they pick.
 */
export function useContentSources(
  content: MaybeRefOrGetter<ContentsItem | null | undefined>,
  surface: RenditionSurface = 'viewer',
) {
  const settingsStore = useSettingsStore()
  const av1Supported = useAv1Support()

  const hdUrl = computed(() => toValue(content)?.original ?? '')
  const sdUrl = computed(() => toValue(content)?.sd ?? '')

  /**
   * Gif previews are animated AVIF/WebP; video previews are the mp4 itself, so
   * those fall back to the static poster.
   */
  const previewImageSrc = computed(() => {
    const c = toValue(content)
    if (!c) return ''
    return /\.(avif|webp|png|jpe?g)$/i.test(c.preview ?? '') ? (c.preview ?? '') : (c.static ?? '')
  })

  /** Which rendition is primary. The decision table lives in ~/utils/rendition. */
  const mode = computed<RenditionMode>(() =>
    resolveRenditionMode({
      format: settingsStore.settings.contentFormat,
      av1Supported: av1Supported.value,
      hasSd: sdUrl.value !== '',
      surface,
    }),
  )

  /** Images are always themselves — the preview setting doesn't apply. */
  const usePreviewImage = computed(
    () => mode.value === 'preview' && toValue(content)?.filetype !== 'image',
  )

  /** `<source>` children for a `<video>`, primary first. */
  const videoSources = computed<VideoSource[]>(() => {
    const hd = hdUrl.value ? { src: hdUrl.value, type: AV1_MIME } : null
    const sd = sdUrl.value ? { src: sdUrl.value, type: H264_MIME } : null
    const ordered = mode.value === 'sd' ? [sd, hd] : [hd, sd]
    return ordered.filter((s): s is VideoSource => s !== null)
  })

  /**
   * The URL a link, download or share should point at — the rendition actually
   * being played, falling back to the canonical one.
   */
  const primaryUrl = computed(() => videoSources.value[0]?.src || hdUrl.value)

  return {
    hdUrl,
    sdUrl,
    mode,
    usePreviewImage,
    previewImageSrc,
    videoSources,
    primaryUrl,
  }
}
