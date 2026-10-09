<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import { computed, ref, watch } from 'vue'
import { useVideoVisibility } from '~/composables/useVideoVisibility'

/**
 * Renders a content item's media (video / gif / image) honoring the user's
 * content-format (AVIF preview vs MP4) and data-saving settings. Shared by
 * CardUnified and CardBaseContent.
 *
 * Videos emit `loaded` on BOTH loadedmetadata and loadeddata: iOS Safari
 * stops at loadedmetadata for preload="metadata" (it never buffers frame
 * data until playback), so waiting on loadeddata alone deadlocks the
 * parents' skeleton gating there. Desktop browsers fire both; the duplicate
 * emit is harmless.
 */
const props = defineProps<{
  content: ContentsItem
  /**
   * Overrides the box this item would pick for itself — used by the carousel to
   * hold every item in a set at the set's tallest shape, so stepping through it
   * doesn't resize the card. A CSS `aspect-ratio` value.
   */
  aspectRatioOverride?: string | null
  /**
   * This element is a hidden neighbour in a carousel, mounted so the next step
   * finds it ready. Its video may buffer the whole file (preload="auto")
   * instead of stopping at metadata. Off by default — see useVideoVisibility
   * for why a page of cards must not do this on its own.
   */
  prefetch?: boolean
}>()

const emit = defineEmits<{
  loaded: []
  /** Fired when the media file fails to load (so parents can drop height locks). */
  error: []
  /** Fired from the play overlay on MP4 videos (opens fullscreen w/ autoplay). */
  openFullscreen: []
}>()

const settingsStore = useSettingsStore()

const isDataSaving = computed(() => settingsStore.settings.dataSavingMode === 'Enabled')

// Which rendition plays here, and the <source> list backing it. This is a grid
// card, so HD caps at the SD rendition — see resolveRenditionMode. A device with
// no AV1 decoder gets H.264 rather than the preview image.
const { usePreviewImage, previewImageSrc, videoSources, hdUrl } = useContentSources(
  () => props.content,
  'grid',
)

// Links and the still image use the canonical (HD) URL: what a card *points at*
// is the content itself, whatever rendition happens to be playing inside it.
// The video elements use the resolved source list.
const contentUrl = hdUrl

// Only the final <source> failing means the media is genuinely unavailable —
// an earlier one erroring just moves the browser on to the next candidate, and
// emitting then would drop the parent's height lock on a video that still
// plays.
function onSourceError(index: number) {
  if (index === videoSources.value.length - 1) emit('error')
}

const videoStarted = ref(false)
watch(
  () => props.content.id,
  () => {
    videoStarted.value = false
  },
)

// Firefox renders its own persistent controls; the play overlay would clash.
const isFirefox = import.meta.client && navigator.userAgent.includes('Firefox')

// Only a carousel neighbour buffers ahead. Everything else stops at metadata,
// which is the page's bandwidth budget (see useVideoVisibility).
const preload = computed(() => (props.prefetch ? 'auto' : 'metadata'))

// Images below the fold wait until they're near the viewport — a page of 24
// cards used to fetch all 24 on first paint. A hidden carousel neighbour is the
// exception: a lazy image with no layout box never loads, and it's mounted
// precisely so it loads early.
const imgLoading = computed(() => (props.prefetch ? 'eager' : 'lazy'))

// What a screen reader announces and Google Images indexes. See utils/mediaAlt.
const alt = computed(() => contentAltText(props.content))

// The pipeline's first-frame poster. The card paints a real frame from a tiny
// file before the video's own first frame arrives, and a card the concurrency
// cap is holding paused shows a still instead of an empty box.
const poster = computed(() => props.content.static || undefined)

// Gif <video>s autoplay only while visible (and not in data-saving mode).
const gifVideoRef = ref<HTMLVideoElement | null>(null)
const autoplayGifs = computed(() => !isDataSaving.value)
useVideoVisibility(gifVideoRef, autoplayGifs)

// ─── Reserved media box ──────────────────────────────────────────────────────
// A card has no height until its media arrives, so without a reserved box the
// grid reflows on first paint and every carousel step resizes the card. The
// decision table lives in ~/utils/mediaBox.

const mediaBox = computed(() =>
  resolveMediaBox(
    settingsStore.settings.uniformCardRatio,
    props.content.width,
    props.content.height,
  ),
)

/**
 * The override wins over both, and is letterboxed for the same reason the
 * uniform setting is: it's a shape the item didn't choose.
 */
const box = computed(() =>
  props.aspectRatioOverride
    ? { aspectRatio: props.aspectRatioOverride, isLetterboxed: true }
    : mediaBox.value,
)

/**
 * A pixel ceiling for media with NO reserved box — records from before the
 * backend stored dimensions, and probes that failed. Nothing knows their shape,
 * so there is no ratio to clamp (see MAX_BOX_TALLNESS) and the media would
 * otherwise flow to whatever height it happens to be.
 *
 * Only that case. Applying it to a box that has a ratio is what produced dead
 * space in wide cards: the box declared the media's shape and was then capped
 * shorter than it, so the media had to shrink to fit inside its own box.
 *
 * In a style binding rather than a `max-h-[...]` utility because Tailwind's
 * scanner only sees literal class strings, so an interpolated one emits no CSS.
 */
const FALLBACK_MAX_HEIGHT_PX = 800

const boxStyle = computed(() =>
  box.value.aspectRatio
    ? { aspectRatio: box.value.aspectRatio }
    : { maxHeight: `${FALLBACK_MAX_HEIGHT_PX}px` },
)

/**
 * Media sizing inside the box.
 *
 * Letterboxed: absolutely filled and object-contain, so it fits a shape it didn't
 * pick without ever being cropped. Otherwise `w-full` exactly as before — a box
 * derived from the item's own dimensions is the shape it would have taken anyway,
 * so there's no reason to take it out of flow.
 *
 * `object-contain` on that second path too, for the two cases where the element's
 * box can't match the media's own shape: media past MAX_BOX_TALLNESS, whose ratio
 * was clamped, and media with no stored dimensions, bounded only by the fallback
 * pixel height. Without it the media would stretch to fill the mismatch. A no-op
 * for everything else, which is the overwhelming majority of cards.
 */
const mediaClass = computed(() =>
  box.value.isLetterboxed
    ? 'absolute inset-0 w-full h-full object-contain rounded-md'
    : 'block w-full object-contain rounded-md',
)

/**
 * Only the no-box case needs a height limit on the media itself, and there it is
 * the only thing bounding it. Anything with a ratio is already bounded by the box
 * it shares a shape with, and capping it again is what left the dead space.
 */
const mediaStyle = computed(() =>
  box.value.aspectRatio ? undefined : { maxHeight: `${FALLBACK_MAX_HEIGHT_PX}px` },
)

/** `relative` is only needed once the media is absolutely positioned. */
const boxClass = computed(() => (box.value.isLetterboxed ? 'relative block' : 'block'))
</script>

<template>
  <!-- AVIF preview: user picked AVIF mode, or the device can't decode AV1 -->
  <a v-if="usePreviewImage" :href="contentUrl" :class="boxClass" :style="boxStyle" @click.prevent>
    <img
      :key="content.id"
      :class="mediaClass"
      :style="mediaStyle"
      :src="previewImageSrc"
      :width="content.width || undefined"
      :height="content.height || undefined"
      :alt="alt"
      :loading="imgLoading"
      decoding="async"
      @load="emit('loaded')"
      @error="emit('error')"
    />
    <div
      v-if="isDataSaving"
      class="absolute top-0 left-0 w-full h-full flex items-center justify-center"
    >
      <UIcon name="i-lucide-circle-play" class="text-5xl! opacity-50" />
    </div>
  </a>

  <!-- MP4 video with native controls + fullscreen play overlay -->
  <div v-else-if="content.filetype === 'video'" :class="boxClass" :style="boxStyle">
    <video
      :key="content.id"
      :class="`${mediaClass} video-hover-controls`"
      :style="mediaStyle"
      controls
      playsinline
      :preload="preload"
      :poster="poster"
      :width="content.width || 250"
      :height="content.height || undefined"
      @click.stop
      @loadedmetadata="emit('loaded')"
      @loadeddata="emit('loaded')"
      @error="emit('error')"
      @play="videoStarted = true"
    >
      <!-- source-level error fires when the file itself can't be fetched -->
      <source
        v-for="(source, i) in videoSources"
        :key="source.src"
        :src="source.src"
        :type="source.type"
        @error="onSourceError(i)"
      />
    </video>
    <div
      v-if="!isFirefox && !videoStarted"
      class="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none"
    >
      <button
        type="button"
        aria-label="Play"
        class="pointer-events-auto bg-transparent border-0 cursor-pointer p-2 flex items-center justify-center"
        @click.stop.prevent="emit('openFullscreen')"
      >
        <UIcon name="i-lucide-circle-play" class="text-5xl! opacity-50" />
      </button>
    </div>
  </div>

  <!-- Gif as looping MP4 -->
  <a
    v-else-if="content.filetype === 'gif'"
    :href="contentUrl"
    :class="boxClass"
    :style="boxStyle"
    @click.prevent
  >
    <video
      :key="content.id"
      ref="gifVideoRef"
      :class="mediaClass"
      :style="mediaStyle"
      muted
      loop
      playsinline
      :preload="preload"
      :poster="poster"
      :width="content.width || 250"
      :height="content.height || undefined"
      @loadedmetadata="emit('loaded')"
      @loadeddata="emit('loaded')"
      @error="emit('error')"
    >
      <source
        v-for="(source, i) in videoSources"
        :key="source.src"
        :src="source.src"
        :type="source.type"
        @error="onSourceError(i)"
      />
    </video>
    <div
      v-if="isDataSaving"
      class="absolute top-0 left-0 w-full h-full flex items-center justify-center"
    >
      <UIcon name="i-lucide-circle-play" class="text-5xl! opacity-50" />
    </div>
  </a>

  <!-- Static image -->
  <a v-else :href="contentUrl" :class="boxClass" :style="boxStyle" @click.prevent>
    <img
      :key="content.id"
      :class="mediaClass"
      :style="mediaStyle"
      :src="contentUrl"
      :width="content.width || undefined"
      :height="content.height || undefined"
      :alt="alt"
      :loading="imgLoading"
      decoding="async"
      @load="emit('loaded')"
      @error="emit('error')"
    />
  </a>
</template>
