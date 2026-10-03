<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import { computed, ref, watch } from 'vue'

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

const emit = defineEmits<{ close: [] }>()

const { videoSources, primaryUrl: contentUrl } = useContentSources(() => props.content)

const videoRef = ref<HTMLVideoElement | null>(null)

/** Whether this item plays when shown: gifs always, videos when the opener asked. */
const shouldPlay = computed(() => props.content.filetype === 'gif' || !!props.autoplay)

// Bound once, at creation: the attribute only ever affects the initial load.
const autoplayAttr = props.active && shouldPlay.value

watch(
  () => props.active,
  (active) => {
    const el = videoRef.value
    if (!el) return
    if (active && shouldPlay.value) el.play().catch(() => {})
    else if (!active) el.pause()
  },
)

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
      style="max-height: 93vh; max-width: 93vw; width: auto"
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
        style="max-height: 93vh; max-width: 93vw; width: auto"
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
  <div v-else @click.stop="emit('close')">
    <a :href="contentUrl" @click.prevent>
      <img
        class="block rounded-xl"
        style="max-height: 93vh; max-width: 93vw; width: auto"
        :src="contentUrl"
        alt="pic"
      />
    </a>
  </div>
</template>
