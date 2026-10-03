<script setup lang="ts">
/**
 * A rotated 4×7 grid of tiles whose rows drift horizontally with the cursor
 * (adjacent rows counter-move, each with its own easing for a parallax feel).
 * Adapted from nxui's "Grid Motion" to this codebase: sources the app's
 * `assets/bg` imagery by default, themed on the night palette, edges softly
 * masked so it reads as a centered vignette rather than a fullscreen wall.
 *
 * Mobile: the whole grid is `v-if`'d out below the md breakpoint — no tiles
 * in the DOM, no images fetched, no animation loop. The cursor animation also
 * only runs when there's a fine pointer and reduced-motion isn't requested;
 * everything is reactive, so plugging in a mouse or resizing adapts live.
 */
const props = withDefaults(
  defineProps<{
    // Tile contents: image URLs (repeated to fill) or plain text. Defaults to
    // the images in ~/assets/bg.
    items?: string[]
    opacity?: number
    // Radial overlay color that darkens the center for foreground legibility.
    gradientColor?: string
  }>(),
  {
    items: () => [],
    opacity: 0.4,
    gradientColor: 'var(--color-night-950)',
  },
)

const ROWS = 4
const COLS = 7
const TOTAL = ROWS * COLS

const bgModules = import.meta.glob('~/assets/bg/*', { eager: true, import: 'default' })
const bgImages = Object.values(bgModules) as string[]

// Fill exactly TOTAL tiles, cycling through whatever source we have.
const tiles = computed<string[]>(() => {
  const source = props.items.length > 0 ? props.items : bgImages
  if (source.length === 0) return Array.from({ length: TOTAL }, (_, i) => `${i + 1}`)
  return Array.from({ length: TOTAL }, (_, i) => source[i % source.length]!)
})

const rows = computed<string[][]>(() =>
  Array.from({ length: ROWS }, (_, r) => tiles.value.slice(r * COLS, r * COLS + COLS)),
)

function isImage(content: string): boolean {
  return content.startsWith('http') || content.startsWith('/')
}

// ─── Visibility / capability gates (all reactive) ────────────────────────────
// Render only on md+ (a rotated 28-tile grid doesn't suit narrow screens), and
// only animate when there's a fine pointer and the user hasn't asked for
// reduced motion.
const isDesktop = useMediaQuery('(min-width: 768px)')
const finePointer = useMediaQuery('(pointer: fine)')
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const shouldAnimate = computed(() => isDesktop.value && finePointer.value && !reducedMotion.value)

// ─── Cursor-driven row motion ────────────────────────────────────────────────
// rowPositions is deliberately plain (not reactive): the rAF loop mutates it
// and writes straight to the DOM, so it must not trigger re-renders.
const rowRefs = ref<(HTMLDivElement | null)[]>([])
const mouseX = ref(typeof window !== 'undefined' ? window.innerWidth / 2 : 0)
const rowPositions = [0, 0, 0, 0]

const inertiaFactors = [0.6, 0.4, 0.3, 0.2]
const MAX_MOVE = 300
const EASE_SPEED = 0.08

let animationId = 0

useEventListener('mousemove', (e: MouseEvent) => {
  if (shouldAnimate.value) mouseX.value = e.clientX
})

function frame() {
  animationId = requestAnimationFrame(frame)
  const w = window.innerWidth
  if (w === 0) return
  for (let i = 0; i < ROWS; i++) {
    const direction = i % 2 === 0 ? 1 : -1
    const target = ((mouseX.value / w) * MAX_MOVE - MAX_MOVE / 2) * direction
    const factor = EASE_SPEED / (1 + inertiaFactors[i]!)
    rowPositions[i]! += (target - rowPositions[i]!) * factor
    const row = rowRefs.value[i]
    if (row) row.style.transform = `translateX(${rowPositions[i]}px)`
  }
}

function stopLoop() {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = 0
  }
  // Reset offsets so a later re-show (e.g. mobile→desktop resize) starts centered.
  for (let i = 0; i < ROWS; i++) {
    rowPositions[i] = 0
    const row = rowRefs.value[i]
    if (row) row.style.transform = ''
  }
}

watch(
  shouldAnimate,
  (on) => {
    if (on) {
      if (!animationId) animationId = requestAnimationFrame(frame)
    } else {
      stopLoop()
    }
  },
  { immediate: true },
)

onBeforeUnmount(stopLoop)
</script>

<template>
  <div v-if="isDesktop" class="grid-motion" aria-hidden="true">
    <div class="grid-motion-tiles" :style="{ opacity: props.opacity }">
      <div
        v-for="(row, rowIndex) in rows"
        :key="rowIndex"
        :ref="(el) => (rowRefs[rowIndex] = el as HTMLDivElement | null)"
        class="grid-motion-row"
      >
        <div v-for="(content, itemIndex) in row" :key="itemIndex" class="grid-motion-tile">
          <div
            v-if="isImage(content)"
            class="grid-motion-image"
            :style="{ backgroundImage: `url(${content})` }"
          />
          <span v-else class="grid-motion-label">{{ content }}</span>
        </div>
      </div>
    </div>
    <div
      class="grid-motion-overlay"
      :style="{
        background: `radial-gradient(circle at 50% 50%, ${props.gradientColor} 0%, transparent 70%)`,
      }"
    />
  </div>
</template>

<style scoped>
.grid-motion {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  /* Soft vignette: opaque only near the center, then a long gentle fade that
     ends well inside the viewport so the grid never hard-cuts at the edges. */
  mask-image: radial-gradient(ellipse 78% 78% at 50% 50%, black 12%, transparent 72%);
  -webkit-mask-image: radial-gradient(ellipse 78% 78% at 50% 50%, black 12%, transparent 72%);
}

.grid-motion-tiles {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 150vw;
  height: 150vh;
  transform: translate(-50%, -50%) rotate(-15deg);
  transform-origin: center;
  display: grid;
  grid-template-rows: repeat(4, 1fr);
  gap: 1rem;
}

.grid-motion-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1rem;
  will-change: transform;
}

.grid-motion-tile {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  background: var(--color-night-800);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--color-night-700), transparent 55%);
}

.grid-motion-image {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
}

.grid-motion-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-night-500);
  font-size: 1.25rem;
}

/* Darkens the center over the tiles so foreground content stays legible. */
.grid-motion-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
</style>
