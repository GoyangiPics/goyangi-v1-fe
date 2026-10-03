<script setup lang="ts">
/**
 * The floating like pill on card media, with the cat-ear pop animation
 * (keyframes in app/assets/cards.css). The button pads out an oversized
 * hit area so it's easy to tap without opening the fullscreen view.
 */
import { onLongPress } from '@vueuse/core'
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    liked: boolean
    animating: boolean
    count: string
    /** Enable hold-to-like-the-whole-set. Only meaningful on multi-item sets. */
    allowLikeAll?: boolean
  }>(),
  { allowLikeAll: false },
)

const emit = defineEmits<{
  like: []
  likeAll: []
}>()

/**
 * Hold duration for like-all. Long enough not to fire on a slow tap.
 *
 * Fed to the progress fill's animation as a CSS variable rather than being
 * duplicated in cards.css: the bar has to finish exactly as the action fires, and
 * two hard-coded numbers drift apart the first time one of them is tuned.
 */
const HOLD_MS = 1500

const buttonRef = ref<HTMLElement | null>(null)
const isHolding = ref(false)

// A completed long press is followed by a click on most platforms, which would
// also fire the single like. One-shot flag, cleared by whichever comes first.
const suppressClick = ref(false)

onLongPress(
  buttonRef,
  () => {
    if (!props.allowLikeAll) return
    isHolding.value = false
    suppressClick.value = true
    emit('likeAll')
  },
  {
    delay: HOLD_MS,
    // Cancel the hold if the finger drifts — this pill sits on a swipeable
    // media area, so a swipe that starts on it must not become a like-all.
    distanceThreshold: 12,
    // Deliberately no `modifiers: { prevent: true }`: that calls
    // preventDefault() on pointerdown, which suppresses the compatibility
    // mousedown/click in Chromium — i.e. it would break plain tap-to-like. The
    // OS long-press callout is suppressed with CSS instead (see the style
    // block below).
  },
)

function onPointerDown() {
  if (props.allowLikeAll) isHolding.value = true
}

function endHold() {
  isHolding.value = false
}

function onClick() {
  if (suppressClick.value) {
    suppressClick.value = false
    return
  }
  emit('like')
}
</script>

<template>
  <button
    ref="buttonRef"
    type="button"
    :aria-label="liked ? 'Unlike' : 'Like'"
    class="like-button group/like absolute top-0 right-0 z-20 p-3 flex items-start justify-end bg-transparent border-0 cursor-pointer"
    @click.stop.prevent="onClick"
    @contextmenu.prevent
    @mousedown.stop
    @pointerdown.stop="onPointerDown"
    @pointerup="endHold"
    @pointerleave="endHold"
    @pointercancel="endHold"
  >
    <span
      class="relative overflow-hidden flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-white text-xs font-medium opacity-65 transition-all duration-200 group-hover/like:opacity-100 group-hover/like:bg-black/55"
    >
      <!-- Hold progress. Transform-based because a conic-gradient ring isn't
           animatable without @property. -->
      <span v-if="isHolding" class="like-hold-fill" :style="{ '--like-hold-ms': `${HOLD_MS}ms` }" />
      <span class="relative inline-flex">
        <span v-if="animating" class="cat-ear cat-ear-left" />
        <span v-if="animating" class="cat-ear cat-ear-right" />
        <UIcon
          name="i-lucide-heart"
          mode="svg"
          class="text-base"
          :class="[liked ? 'text-pink-500 icon-filled' : 'text-white', animating && 'heart-pop']"
        />
      </span>
      <span class="relative">{{ count }}</span>
    </span>
  </button>
</template>

<style scoped>
/* Suppress the OS long-press callout / text selection without touching
   preventDefault on pointerdown, which would kill tap-to-like. */
.like-button {
  touch-action: manipulation;
  -webkit-touch-callout: none;
  user-select: none;
}
</style>
