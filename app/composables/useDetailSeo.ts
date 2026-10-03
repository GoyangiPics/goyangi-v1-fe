import { computed } from 'vue'

interface OgBase {
  preview?: string
  original?: string
  /** H.264 720p rendition, served by the `?sd` embed variant. */
  sd?: string
  /**
   * Filetype of the embedded content (for sets/collections: the first item).
   * `video` forces mp4 embed mode — see `isMp4Mode`.
   */
  filetype?: string
}

interface DetailSeoOptions<T extends OgBase> {
  /** URL segment + canonical/og key: 'single' | 'set' | 'collection'. */
  type: 'single' | 'set' | 'collection'
  id: string
  /** SSR-side fetch of the OG payload (runs via useAsyncData). */
  fetchOg: () => Promise<T>
  /** Derive the social/title text from the fetched data. */
  title: (data: T | null) => string
  /** Derive the social/description text from the fetched data. */
  description: (data: T | null) => string
}

/**
 * Shared SSR SEO wiring for the content detail pages (single/set/collection):
 * fetches the OG payload, derives og:image/og:video (honoring `?mp4` and `?sd`),
 * and applies useSeoMeta + the canonical link. Returns the fetched `ogData`.
 *
 * NOTE: intentionally NOT async and does NOT await useAsyncData. Calling
 * useSeoMeta/useHead after an `await` inside a nested composable loses the
 * component instance context and throws during SSR (→ 500). Instead we set up
 * the head synchronously with reactive getters; Nuxt still blocks the SSR
 * render on the pending (non-lazy) useAsyncData, so the resolved OG values are
 * present in the server-rendered head that Discord scrapes.
 */
export function useDetailSeo<T extends OgBase>(opts: DetailSeoOptions<T>) {
  const route = useRoute()

  const { data } = useAsyncData(`og-${opts.type}-${opts.id}`, opts.fetchOg)
  // useAsyncData's transform typing widens the value; normalize back to T | null.
  const ogData = computed<T | null>(() => (data.value ?? null) as T | null)

  // `?sd` embeds the H.264 720p copy. It exists because Safari below A17 Pro / M3
  // renders an AV1 MP4 as a blank frame rather than degrading, so a link shared
  // into a mixed-device chat needs a way to hand over the compatible rendition.
  //
  // Falls back to the AV1 original when `sd` is absent — it is best-effort in the
  // pipeline and missing entirely on records that predate the rendition, and an
  // empty og:video would embed nothing at all.
  const isSdMode = computed(() => route.query.sd !== undefined)

  // `?mp4` opts any content into the raw-mp4 embed. Video content is opted in
  // unconditionally: the pipeline builds no AVIF preview for it, so the
  // preview-based embed has nothing to show and both forms of the URL have to
  // fall back to the mp4 anyway.
  const isMp4Mode = computed(
    () => isSdMode.value || route.query.mp4 !== undefined || ogData.value?.filetype === 'video',
  )

  /** The mp4 URL for whichever variant is active. */
  const videoUrl = computed(() =>
    isSdMode.value
      ? ogData.value?.sd || ogData.value?.original || ''
      : ogData.value?.original || '',
  )

  const ogImage = computed(() =>
    isMp4Mode.value ? videoUrl.value : ogData.value?.preview || ogData.value?.original || '',
  )
  const ogVideo = computed(() => (isMp4Mode.value ? videoUrl.value : undefined))
  const ogTitle = computed(() => opts.title(ogData.value))
  const ogDescription = computed(() => opts.description(ogData.value))

  useSeoMeta({
    title: ogTitle,
    description: ogDescription,
    ogSiteName: '🐱 goyangi.pics',
    ogTitle,
    ogType: 'website',
    ogDescription,
    ogImage,
    ogVideo,
    ogVideoSecureUrl: ogVideo,
    ogVideoType: computed(() => (isMp4Mode.value ? 'video/mp4' : undefined)),
    twitterCard: 'summary_large_image',
    twitterTitle: ogTitle,
    twitterDescription: ogDescription,
    twitterImage: ogImage,
  })

  useHead({
    link: [{ rel: 'canonical', href: `https://goyangi.pics/${opts.type}/${opts.id}` }],
  })

  return { ogData }
}
