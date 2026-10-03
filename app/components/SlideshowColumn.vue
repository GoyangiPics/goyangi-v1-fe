<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import { computed, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  items: ContentsItem[]
  loopsPerContent: number
  isGloballyPlaying: boolean
}>()

/** ms a single image "loop" lasts */
const IMAGE_LOOP_MS = 4000

const currentIndex = ref(0)
const advanceCount = ref(0) // ever-increasing; used as the transition key so wrapping back to index 0 still creates a fresh DOM node
const loopCount = ref(0)
const videoRef = ref<HTMLVideoElement>()
const imageTimerId = ref<ReturnType<typeof setTimeout>>()

const currentItem = computed(() => props.items[currentIndex.value])

const isVideoType = computed(
  () => currentItem.value?.filetype === 'video' || currentItem.value?.filetype === 'gif',
)

const { videoSources, primaryUrl } = useContentSources(currentItem)

// ── advancement ──────────────────────────────────────────────────────────────

function advance() {
  loopCount.value = 0
  currentIndex.value = (currentIndex.value + 1) % props.items.length
  advanceCount.value++
}

// ── image timer ───────────────────────────────────────────────────────────────

function clearImageTimer() {
  clearTimeout(imageTimerId.value)
}

function startImageTimer() {
  clearImageTimer()
  if (!props.isGloballyPlaying) return
  imageTimerId.value = setTimeout(advance, props.loopsPerContent * IMAGE_LOOP_MS)
}

// ── video callbacks ───────────────────────────────────────────────────────────

function onVideoLoaded() {
  if (props.isGloballyPlaying) {
    videoRef.value?.play().catch(() => {})
  }
}

function onVideoEnded() {
  if (!props.isGloballyPlaying) return
  loopCount.value++
  if (loopCount.value >= props.loopsPerContent) {
    advance()
  } else {
    videoRef.value?.play().catch(() => {})
  }
}

// ── watchers ──────────────────────────────────────────────────────────────────

// Fires on every advance (including wrapping back to the same index/item).
// `currentItem` alone wouldn't retrigger when looping a single-item list.
watch(
  advanceCount,
  () => {
    clearImageTimer()
    if (currentItem.value && !isVideoType.value && props.isGloballyPlaying) {
      startImageTimer()
    }
  },
  { immediate: true },
)

// global play / pause
watch(
  () => props.isGloballyPlaying,
  (playing) => {
    if (playing) {
      if (isVideoType.value) {
        videoRef.value?.play().catch(() => {})
      } else {
        startImageTimer()
      }
    } else {
      videoRef.value?.pause()
      clearImageTimer()
    }
  },
)

onUnmounted(clearImageTimer)
</script>

<template>
  <div class="relative flex-1 overflow-hidden rounded-lg bg-black min-w-0">
    <!-- content transitions via key — re-mounts on each advance -->
    <Transition name="ss-fade" mode="out-in">
      <div :key="advanceCount" class="absolute inset-0 flex items-center justify-center">
        <!-- video / gif -->
        <video
          v-if="isVideoType && currentItem"
          ref="videoRef"
          class="w-full h-full object-contain"
          :muted="currentItem.filetype !== 'video'"
          :controls="currentItem.filetype === 'video'"
          playsinline
          preload="auto"
          @loadeddata="onVideoLoaded"
          @ended="onVideoEnded"
        >
          <source v-for="s in videoSources" :key="s.src" :src="s.src" :type="s.type" />
        </video>

        <!-- image -->
        <img
          v-else-if="currentItem"
          class="w-full h-full object-contain"
          :src="primaryUrl"
          alt=""
          draggable="false"
        />
      </div>
    </Transition>

    <!-- position badge -->
    <div
      class="absolute bottom-2 right-2 text-xs text-white/30 select-none tabular-nums pointer-events-none"
    >
      {{ currentIndex + 1 }} / {{ items.length }}
    </div>
  </div>
</template>

<style scoped>
.ss-fade-enter-active,
.ss-fade-leave-active {
  transition: opacity 0.35s ease;
}
.ss-fade-enter-from,
.ss-fade-leave-to {
  opacity: 0;
}
</style>
