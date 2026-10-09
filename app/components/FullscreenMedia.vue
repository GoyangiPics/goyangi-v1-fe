<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

/**
 * One item's media inside the fullscreen viewer.
 *
 * Split out of DialogBaseFullscreen so the viewer can keep several of these
 * mounted at once — the active item, the one just stepped away from, and the
 * one ahead — and show one. A media element is the buffer, so an element that
 * stays mounted keeps what it downloaded, and a hidden one loads while nobody
 * is looking. The viewer used to remount on every step, which started the HD
 * fetch over each time.
 *
 * Playback follows `active`. An element created active starts through the
 * `autoplay` attribute, which waits for data on its own; calling play() during
 * creation instead races Chrome's pending source selection and gets aborted
 * ("interrupted by a new load request"), leaving the clip paused. An element
 * mounted hidden gets play() when it is shown — by then its load is under way,
 * and there is no new load to interrupt. The outgoing one is told to stop: a
 * hidden unmuted video would otherwise keep talking.
 */
const props = defineProps<{
  content: ContentsItem
  /** Whether this is the item being shown. Hidden otherwise (v-show by the parent). */
  active: boolean
  /** Start `video` items on show. Gifs always loop; images have nothing to start. */
  autoplay?: boolean
  /** iOS blocks unmuted autoplay, so `video` items there start muted. */
  muteVideo?: boolean
}>()

const emit = defineEmits<{
  close: []
  /** Zoomed in or back out — the viewer pauses its own gestures meanwhile. */
  zoom: [zoomed: boolean]
}>()

const { videoSources, primaryUrl: contentUrl } = useContentSources(() => props.content)

const videoRef = ref<HTMLVideoElement | null>(null)

/** Whether this item plays when shown: gifs always, videos when the opener asked. */
const shouldPlay = computed(() => props.content.filetype === 'gif' || !!props.autoplay)

// Bound once, at creation: the attribute only ever affects the initial load.
const autoplayAttr = props.active && shouldPlay.value

watch(
  () => props.active,
  (active) => {
    // A picture left zoomed would come back zoomed on the next visit.
    if (!active) zoom.reset()
    const el = videoRef.value
    if (!el) return
    if (active && shouldPlay.value) el.play().catch(() => {})
    else if (!active) el.pause()
  },
)

// ─── Zoom (pictures only) ────────────────────────────────────────────────────
// Videos and gifs keep their native controls and tap-to-close; detail is what
// people zoom a still for.
const zoomBoxRef = ref<HTMLElement | null>(null)
const zoom = useMediaZoom(zoomBoxRef, { onTap: () => emit('close') })

watch(zoom.isZoomed, (zoomed) => emit('zoom', zoomed))
onBeforeUnmount(() => zoom.dispose())

/**
 * The viewer's swipe listens for touches on the whole body. A pinch, or a pan
 * of a zoomed picture, is not a swipe — so those touches stop here. Tracked per
 * gesture: after a pinch, the finger left down would otherwise finish as a
 * swipe measured from where the pinch began.
 */
let multiTouch = false
function guardTouch(e: TouchEvent) {
  if (e.touches.length > 1) multiTouch = true
  if (multiTouch || zoom.isZoomed.value) e.stopPropagation()
  if (e.type === 'touchend' && e.touches.length === 0) multiTouch = false
}

/**
 * The media's on-screen box, worked out from the stored dimensions before a
 * byte has arrived.
 *
 * With only a max-width/height, an element that hasn't loaded has no shape — a
 * video sits at the browser's 300×150 default and an image at nothing — and then
 * snaps to its real size, dragging the counter, like pill and dots with it on
 * every step to an item not yet buffered. This is the same fit the max-* pair
 * gave once loaded: as large as 93vw × 93vh allows, never past the file's own
 * width, at the file's own ratio.
 *
 * Records from before dimensions were stored keep the old sizing.
 */
const mediaStyle = computed(() => {
  const { width: w, height: h } = props.content
  if (!w || !h) return { maxHeight: '93vh', maxWidth: '93vw', width: 'auto' }
  return {
    width: `min(93vw, calc(93vh * ${w / h}), ${w}px)`,
    aspectRatio: `${w} / ${h}`,
    height: 'auto',
    objectFit: 'contain' as const,
  }
})

const alt = computed(() => contentAltText(props.content))

/** Bottom strip of a video reserved for the native controls. */
const CONTROLS_ZONE = 60

// A click on the controls is scrubbing or volume, not "close".
function onVideoClick(e: MouseEvent) {
  const video = e.currentTarget as HTMLVideoElement
  const rect = video.getBoundingClientRect()
  if (e.clientY - rect.top > rect.height - CONTROLS_ZONE) e.stopPropagation()
}
</script>

<template>
  <!-- preload="auto" on every video: the hidden ones are here to buffer ahead,
       and the active one wants the whole file anyway. -->
  <div v-if="content.filetype === 'video'" @click.stop="emit('close')">
    <video
      ref="videoRef"
      class="block rounded-xl"
      :style="mediaStyle"
      :autoplay="autoplayAttr"
      :muted="muteVideo"
      :loop="false"
      controls
      playsinline
      preload="auto"
      @click="onVideoClick"
    >
      <source v-for="s in videoSources" :key="s.src" :src="s.src" :type="s.type" />
    </video>
  </div>
  <div v-else-if="content.filetype === 'gif'" @click.stop="emit('close')">
    <a :href="contentUrl" @click.prevent>
      <video
        ref="videoRef"
        class="block rounded-xl"
        :style="mediaStyle"
        :autoplay="autoplayAttr"
        muted
        loop
        playsinline
        preload="auto"
      >
        <source v-for="s in videoSources" :key="s.src" :src="s.src" :type="s.type" />
      </video>
    </a>
  </div>
  <!-- No click-to-close on the wrapper here: a tap on a picture might be the
       first half of a double-tap, so useMediaZoom decides when it closes. -->
  <div v-else ref="zoomBoxRef">
    <a :href="contentUrl" @click.prevent>
      <img
        class="block rounded-xl select-none"
        :style="[mediaStyle, zoom.style.value]"
        :src="contentUrl"
        :alt="alt"
        draggable="false"
        v-on="zoom.handlers"
        @click.stop.prevent
        @touchstart="guardTouch"
        @touchmove="guardTouch"
        @touchend="guardTouch"
        @gesturestart.prevent
      />
    </a>
  </div>
</template>
