<script setup lang="ts">
/**
 * Instagram-style position indicator for a set carousel.
 *
 * Exists because swipe was undiscoverable on mobile: the prev/next arrows are
 * `hidden sm:block`, so on a phone nothing said a card held more than one item.
 *
 * Purely presentational — the parent positions it. Not tappable
 * (`pointer-events-none`): the whole media area is one tap target for
 * fullscreen, 6px dots inside it would be a mis-tap trap far below the 44px
 * guidance, and they would fight the `useSwipe` bound to the same element. The
 * fullscreen counter pill sets the same precedent.
 */
const props = withDefaults(
  defineProps<{
    /** Total items in the set. */
    count: number
    /** 0-based active index. */
    index: number
    /** Above this, show a count instead of dots. */
    pillThreshold?: number
    /** Max dots on screen before windowing. */
    window?: number
  }>(),
  { pillThreshold: 24, window: 7 },
)

/**
 * Three tiers, because a set can hold 200 items:
 *  - up to `window`: one dot each.
 *  - up to `pillThreshold`: a sliding window, with scaled-down edge dots as a
 *    "more that way" cue.
 *  - beyond that: "n / count". A 7-dot window over 200 items conveys almost no
 *    positional information, while the number does — and the affordance's real
 *    job ("there is more here, swipe") is served either way.
 */
const mode = computed<'dots' | 'window' | 'pill'>(() => {
  if (props.count > props.pillThreshold) return 'pill'
  if (props.count > props.window) return 'window'
  return 'dots'
})

/** Indices currently rendered, centred on `index` and clamped to the ends. */
const visibleIndices = computed<number[]>(() => {
  if (mode.value === 'pill') return []
  if (mode.value === 'dots') return Array.from({ length: props.count }, (_, i) => i)

  const half = Math.floor(props.window / 2)
  const start = Math.min(Math.max(props.index - half, 0), props.count - props.window)
  return Array.from({ length: props.window }, (_, i) => start + i)
})

/** True for a window edge that isn't also a list edge — i.e. "more this way". */
function isFadedEdge(i: number): boolean {
  if (mode.value !== 'window') return false
  const first = visibleIndices.value[0]
  const last = visibleIndices.value[visibleIndices.value.length - 1]
  if (i === first && first !== 0) return true
  if (i === last && last !== props.count - 1) return true
  return false
}
</script>

<template>
  <div
    class="pointer-events-none select-none flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40 backdrop-blur-md"
    aria-hidden="true"
  >
    <template v-if="mode === 'pill'">
      <span class="text-xs font-mono text-white/90 leading-none px-0.5">
        {{ index + 1 }} / {{ count }}
      </span>
    </template>
    <template v-else>
      <span
        v-for="i in visibleIndices"
        :key="i"
        class="rounded-full transition-all duration-200"
        :class="[
          i === index ? 'bg-white' : 'bg-white/45',
          isFadedEdge(i) ? 'w-1 h-1' : 'w-1.5 h-1.5',
        ]"
      />
    </template>
  </div>
</template>
