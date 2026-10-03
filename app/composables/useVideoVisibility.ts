import type { Ref } from 'vue'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MAX_CONCURRENT_GIFS, pickPlayable } from '~/utils/playbackCap'

interface Tracked {
  onIntersect: (entry: IntersectionObserverEntry) => void
  isVisible: Ref<boolean>
  /** Inside the concurrency cap — see rerank(). */
  isAllowed: Ref<boolean>
  /**
   * This element replaced one that was playing (a set card stepping to its next
   * clip) and has not been ranked yet. The next rerank seats it as if it had
   * been playing all along, so it competes as an incumbent rather than as a
   * newcomer at the mercy of the hysteresis — see pickPlayable.
   */
  inheritsSlot: boolean
}

/** Every mounted gif video on the page, whether or not it is on screen. */
const tracked = new Map<HTMLVideoElement, Tracked>()
let sharedObserver: IntersectionObserver | null = null

/**
 * One observer for every card. `rootMargin` is zero on purpose: a card used to
 * start playing 200px before it scrolled in, which meant decoders spinning up
 * for cards nobody could see yet. Now a card plays once a tenth of it is
 * actually on screen.
 */
function getSharedObserver(): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          tracked.get(entry.target as HTMLVideoElement)?.onIntersect(entry)
        scheduleRerank()
      },
      { threshold: 0.1 },
    )
    window.addEventListener('scroll', onScroll, { passive: true })
  }
  return sharedObserver
}

function releaseSharedObserver() {
  sharedObserver?.disconnect()
  sharedObserver = null
  window.removeEventListener('scroll', onScroll)
  if (rerankFrame !== null) cancelAnimationFrame(rerankFrame)
  rerankFrame = null
}

// ─── Concurrency cap ─────────────────────────────────────────────────────────
//
// Visibility alone let every card on screen decode at once — twenty on a
// four-column desktop — and the GPU's video decoder is a shared, finite thing:
// past its budget every gif stutters, not just the twenty-first. So of the
// visible cards, only the MAX_CONCURRENT_GIFS nearest the viewport's centre
// play. The rest sit paused on their poster frame until they scroll closer.

let rerankFrame: number | null = null
let playing = new Set<HTMLVideoElement>()

function scheduleRerank() {
  if (rerankFrame !== null) return
  rerankFrame = requestAnimationFrame(() => {
    rerankFrame = null
    rerank()
  })
}

/** Scrolling only changes the ranking when there is something to rank. */
function onScroll() {
  let visible = 0
  for (const t of tracked.values()) if (t.isVisible.value) visible++
  if (visible > MAX_CONCURRENT_GIFS) scheduleRerank()
}

function rerank() {
  const visible: { item: HTMLVideoElement; top: number; bottom: number }[] = []
  for (const [el, t] of tracked) {
    if (!t.isVisible.value) continue
    if (t.inheritsSlot) {
      // Seat the replacement before ranking, so `playing` — the ranking's notion
      // of "previous" — already contains it. Only once it is visible: the
      // observer has to have reported it, or it isn't in the list at all.
      playing.add(el)
      t.inheritsSlot = false
    }
    const rect = el.getBoundingClientRect()
    visible.push({ item: el, top: rect.top, bottom: rect.bottom })
  }
  playing = pickPlayable(visible, window.innerHeight, MAX_CONCURRENT_GIFS, playing)
  for (const [el, t] of tracked) t.isAllowed.value = playing.has(el)
}

/**
 * How many fullscreen dialogs are open right now.
 *
 * Module-level, so every card's video on the page reads the same flag. While a
 * fullscreen viewer is up, the grid behind it is still "visible" to the
 * IntersectionObserver — it is merely under an overlay — so without this every
 * card kept autoplaying under the backdrop: distracting at the edges of the
 * blur, and a dozen decoders' worth of CPU for nothing. A depth, not a boolean,
 * so a dialog closing can't un-pause the grid while another is still open.
 */
const fullscreenDepth = ref(0)

/** Called by DialogBaseFullscreen on mount and unmount. */
export function markFullscreen(open: boolean) {
  fullscreenDepth.value = Math.max(0, fullscreenDepth.value + (open ? 1 : -1))
}

export function useVideoVisibility(videoRef: Ref<HTMLVideoElement | null>, autoplay: Ref<boolean>) {
  const isVisible = ref(false)
  const isAllowed = ref(true)

  function onIntersect(entry: IntersectionObserverEntry) {
    isVisible.value = entry.isIntersecting
  }

  // Off-screen videos stay at preload="metadata" (set in the template). They
  // used to upgrade themselves to preload="auto" after half a second so they'd
  // be buffered by the time they scrolled in, which meant a page of cards
  // pulled every file in full — 190 MB in 27 s in one trace — and the visible
  // ones fought the invisible ones for bandwidth and stalled. Playback starts
  // fast enough from metadata alone once a card scrolls in.
  function syncPlayback() {
    const el = videoRef.value
    if (!el) return

    // Fullscreen open: pause regardless of visibility. Resumes through the
    // normal branch below the moment the dialog unmounts.
    if (fullscreenDepth.value > 0) {
      el.pause()
      return
    }

    if (isVisible.value && isAllowed.value && autoplay.value) {
      el.play().catch(() => {})
    } else {
      // Off-screen, outside the concurrency cap, or visible with autoplay
      // disabled (data saving mode).
      el.pause()
    }
  }

  watch([isVisible, isAllowed, autoplay, fullscreenDepth], syncPlayback)

  let observedEl: HTMLVideoElement | null = null
  // Whether the element this composable last let go of was playing. Carried
  // from detach to the next attach because Vue delivers a keyed swap as two
  // ref changes — old → null, then null → new — not one.
  let wasPlaying = false

  function attach(el: HTMLVideoElement) {
    const observer = getSharedObserver()
    tracked.set(el, { onIntersect, isVisible, isAllowed, inheritsSlot: wasPlaying })
    wasPlaying = false
    observer.observe(el)
    observedEl = el
  }

  function detach(el: HTMLVideoElement) {
    wasPlaying = playing.has(el)
    el.pause()
    sharedObserver?.unobserve(el)
    tracked.delete(el)
    playing.delete(el)
    if (tracked.size === 0) releaseSharedObserver()
    else scheduleRerank()
  }

  watch(videoRef, (el, oldEl) => {
    if (oldEl && oldEl !== el) detach(oldEl)
    if (el && el !== observedEl) {
      // New element — reset visibility so syncPlayback re-runs once the observer reports
      isVisible.value = false
      attach(el)
    }
  })

  onMounted(() => {
    const el = videoRef.value
    if (el) attach(el)
  })

  onBeforeUnmount(() => {
    if (observedEl) detach(observedEl)
  })

  return { isVisible }
}
