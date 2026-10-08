<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import { useSwipe } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

const props = defineProps<{
  isVisible: boolean
  content: ContentsItem
  autoplay?: boolean
  /** Show prev/next arrows (set carousels). Navigation also binds ←/→. */
  hasNavigation?: boolean
  /** Total items in the set; drives the counter pill and the dot rail. */
  count?: number
  /** 0-based active index within the set. */
  index?: number
  /** Like pill state — owned by the parent card so the two pills stay in sync.
      The pill renders only when likeCount is provided. */
  liked?: boolean
  likeAnimating?: boolean
  likeCount?: string
  /**
   * The item one step forward, for the parent that knows the order. Mounted
   * hidden once the person has stepped, so the next step finds it loaded — see
   * mountedContents.
   */
  nextContent?: ContentsItem | null
}>()

const emit = defineEmits(['update:isVisible', 'like', 'prev', 'next'])

function handleVisibilityChange(value: boolean) {
  emit('update:isVisible', value)
}

// ─── Mounted window ──────────────────────────────────────────────────────────
//
// Which items have a media element in the DOM (FullscreenMedia, one each). The
// active item always; after the first step, also the items visited most
// recently and the one ahead. Visited items cost nothing to keep — they are
// already loaded, and keeping them is what makes stepping back to any of them
// instant (keeping only the last one meant two steps back re-created the
// element and re-read the file). The one ahead is the prefetch, and it costs a
// whole HD file, which is why it waits for the first step: opening the viewer
// to look at one thing must not fetch a second. Just the next, not the previous
// too — HD files are several times the size of the SD ones the grid prefetches.

const hasStepped = ref(false)

/**
 * How many visited items stay mounted. HD elements are heavier than the cards'
 * SD ones, but a ten-item set is the common size, and evicting inside one meant
 * every loop through it remounted — and re-read — every item.
 */
const MAX_MOUNTED_VISITED = 10

/** Visited items, most recent last. Trimmed to MAX_MOUNTED_VISITED. */
const visited = shallowRef<ContentsItem[]>([props.content])

watch(
  () => props.content,
  (current, previous) => {
    if (previous && previous.id !== current.id) hasStepped.value = true
    const next = visited.value.filter((c) => c.id !== current.id)
    next.push(current)
    visited.value = next.slice(-MAX_MOUNTED_VISITED)
  },
)

const mountedContents = computed<ContentsItem[]>(() => {
  if (!hasStepped.value) return [props.content]
  const out = [...visited.value]
  const ahead = props.nextContent
  if (ahead && !out.some((c) => c.id === ahead.id)) out.push(ahead)
  return out
})

const hasMultiple = computed(() => (props.count ?? 0) > 1)
/** Position indicator shown top-left, e.g. "3/12". */
const counter = computed(() =>
  hasMultiple.value ? `${(props.index ?? 0) + 1}/${props.count}` : '',
)

// iOS blocks unmuted autoplay entirely, so muted-autoplay is the only way the
// video plays on open there. Other platforms keep sound on (they allow unmuted
// autoplay after the user gesture that opened this dialog).
const isIOS =
  import.meta.client &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

// Keyboard: navigate the set with arrows, like with "l". The dialog is
// v-if'd by its parents, so these bind only while fullscreen is open.
// Pause every card video behind the backdrop while this is up. Mounted IS
// open: every parent v-if's this dialog.
onMounted(() => markFullscreen(true))
onBeforeUnmount(() => markFullscreen(false))

defineShortcuts({
  arrowleft: () => {
    if (props.hasNavigation) emit('prev')
  },
  arrowright: () => {
    if (props.hasNavigation) emit('next')
  },
  // Vertical too, in the shorts convention: down (and swipe-up, wheel-down)
  // is next, the way a feed scrolls.
  arrowdown: () => {
    if (props.hasNavigation) emit('next')
  },
  arrowup: () => {
    if (props.hasNavigation) emit('prev')
  },
  l: () => {
    if (props.likeCount !== undefined) emit('like')
  },
})

/** Bottom strip of a video reserved for the native controls. */
const CONTROLS_ZONE = 60

// Touch navigation. The nav arrows only appear on hover, so on mobile a swipe
// was the obvious gesture and there was nothing listening for it — arrows and
// ←/→ keys were the only way through a set.
const bodyRef = ref<HTMLElement | null>(null)

/** The video on screen — several may be mounted, one is shown. */
function activeVideo(): HTMLVideoElement | null {
  for (const video of bodyRef.value?.querySelectorAll('video') ?? []) {
    if (video.getClientRects().length > 0) return video
  }
  return null
}

// A completed swipe can still emit a trailing click on some mobile browsers,
// which would hit the tap-to-close handler on the media and dismiss the dialog
// instead of advancing. Ignore closes that land right after one.
let lastSwipeAt = 0

const { coordsStart } = useSwipe(bodyRef, {
  onSwipeEnd: (_, direction) => {
    if (!props.hasNavigation || startedOnVideoControls()) return
    if (direction === 'none') return
    lastSwipeAt = Date.now()
    // Left or up advances; right or down goes back. Up = next follows the
    // feed convention: the content you're looking at moves up and out.
    emit(direction === 'left' || direction === 'up' ? 'next' : 'prev')
  },
})

/** A horizontal drag along the seek bar is scrubbing, not a swipe. */
function startedOnVideoControls() {
  const video = activeVideo()
  if (!video) return false
  const rect = video.getBoundingClientRect()
  const { x, y } = coordsStart
  return x >= rect.left && x <= rect.right && y >= rect.bottom - CONTROLS_ZONE && y <= rect.bottom
}

/**
 * Mouse wheel / trackpad as a third way through the set.
 *
 * Throttled hard: a single trackpad flick emits dozens of wheel events, and
 * without the gap one gesture would skip half the set. The threshold ignores
 * the sub-pixel deltas an inertial scroll trails off with.
 */
let lastWheelAt = 0
function onWheel(e: WheelEvent) {
  if (!props.hasNavigation || Math.abs(e.deltaY) < 30) return
  const now = Date.now()
  if (now - lastWheelAt < 500) return
  lastWheelAt = now
  emit(e.deltaY > 0 ? 'next' : 'prev')
}

function requestClose() {
  if (Date.now() - lastSwipeAt < 400) return
  handleVisibilityChange(false)
}
</script>

<template>
  <!--
    Fullscreen, i.e. the content box IS the viewport, with the media centred
    inside it. A centred modal is placed with a translate, and a transformed
    box becomes the containing block for its `position: fixed` children — so
    the edge arrows sat 16px from the MEDIA's edges and moved with every step
    to a differently shaped item. With no transform on the box they are pinned
    to the viewport.

    The trade is that empty space is now the content, not the overlay, so the
    click-outside dismiss no longer fires there; the body's own click.self
    takes over that job.
  -->
  <UModal
    :open="isVisible"
    fullscreen
    :ui="{
      overlay: 'bg-black/90 backdrop-blur-[14px]',
      content: 'p-0 border-0 ring-0 divide-y-0 bg-transparent shadow-none overflow-hidden',
    }"
    @update:open="handleVisibilityChange"
  >
    <template #content>
      <div
        ref="bodyRef"
        class="fullscreen-body w-full h-full flex items-center justify-center"
        @wheel.passive="onWheel"
        @click.self="requestClose"
      >
        <div class="relative rounded-xl shadow-2xl">
          <!-- The active item plus, once stepped, the outgoing and next items
               (see mountedContents). Keyed by id so a step moves elements
               rather than remounting them — a remount restarts the fetch. -->
          <FullscreenMedia
            v-for="c in mountedContents"
            v-show="c.id === content.id"
            :key="c.id"
            :content="c"
            :active="c.id === content.id"
            :autoplay="autoplay"
            :mute-video="isIOS"
            @close="requestClose"
          />

          <div
            v-if="counter"
            class="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-white text-xs font-medium select-none pointer-events-none"
          >
            {{ counter }}
          </div>

          <CardLikeButton
            v-if="likeCount !== undefined"
            :liked="!!liked"
            :animating="!!likeAnimating"
            :count="likeCount"
            @like="emit('like')"
          />

          <!-- Fullscreen is where mobile users actually browse a set, and the
               edge arrows below are hover-revealed i.e. desktop-only, so it has
               the same discoverability hole the cards did. -->
          <div
            v-if="hasMultiple"
            class="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none"
            :class="content.filetype === 'video' ? 'bottom-18' : 'bottom-3'"
          >
            <CardCarouselDots :count="count ?? 0" :index="index ?? 0" />
          </div>
        </div>

        <template v-if="hasNavigation">
          <button
            type="button"
            aria-label="Previous"
            class="fullscreen-nav fullscreen-nav-left"
            @click.stop="emit('prev')"
          >
            <UIcon name="i-lucide-chevron-left" class="text-2xl" />
          </button>
          <button
            type="button"
            aria-label="Next"
            class="fullscreen-nav fullscreen-nav-right"
            @click.stop="emit('next')"
          >
            <UIcon name="i-lucide-chevron-right" class="text-2xl" />
          </button>
        </template>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
/* Edge-pinned nav arrows — outside the media so they never cover the
   native video controls. Hidden until the fullscreen body is hovered
   (matches the card arrows' hover-reveal); ←/→ keys always work. */
.fullscreen-nav {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.4);
  color: white;
  cursor: pointer;
  backdrop-filter: blur(8px);
  opacity: 0;
  transition:
    opacity 0.2s,
    background-color 0.2s;
}

.fullscreen-body:hover .fullscreen-nav {
  opacity: 0.7;
}

.fullscreen-body:hover .fullscreen-nav:hover,
.fullscreen-nav:focus-visible {
  opacity: 1;
  background: rgba(0, 0, 0, 0.6);
}

.fullscreen-nav-left {
  left: 16px;
}

.fullscreen-nav-right {
  right: 16px;
}
</style>
