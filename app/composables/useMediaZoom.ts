import type { Ref } from 'vue'
import { computed, ref } from 'vue'

/** How far a picture can be zoomed. Past this it's pixels, not detail. */
const MAX_SCALE = 5
/** Where a double-tap lands: close enough to read detail, not so far it disorients. */
const DOUBLE_TAP_SCALE = 2.5
/** Two taps closer together than this, in time and space, are a double-tap. */
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_SLOP_PX = 30
/** A press that moves further than this is a drag, not a tap. */
const TAP_SLOP_PX = 8

interface Point {
  x: number
  y: number
}

/**
 * Pinch, double-tap and ctrl-wheel zoom for one picture in the fullscreen viewer.
 *
 * Pointer events throughout, so mouse, pen and touch are one code path; the
 * element gets `touch-action: none` so the browser hands pinches over instead
 * of zooming the whole page.
 *
 * `box` is the media's untransformed wrapper: the zoom transform sits on the
 * picture itself, and measuring the transformed element would feed each frame's
 * zoom back into the next. Transform-origin is the top-left corner, so a point
 * `c` in the picture lands at `t + s·c` on screen — keeping `c` under the
 * fingers is then just solving for `t`.
 *
 * Taps are this composable's to decide, because a single tap closes the viewer
 * and a double-tap zooms: the close has to wait out the double-tap window, or
 * the first tap of a double-tap would dismiss the picture before the second
 * landed.
 */
export function useMediaZoom(box: Ref<HTMLElement | null>, opts: { onTap: () => void }) {
  const scale = ref(1)
  const tx = ref(0)
  const ty = ref(0)
  /** Eased only for the double-tap jump; a pinch has to track the fingers 1:1. */
  const animate = ref(false)

  const isZoomed = computed(() => scale.value > 1)

  const style = computed(() => ({
    transform: `translate(${tx.value}px, ${ty.value}px) scale(${scale.value})`,
    transformOrigin: '0 0',
    transition: animate.value ? 'transform 200ms ease-out' : 'none',
    touchAction: 'none',
    cursor: isZoomed.value ? 'grab' : 'zoom-in',
  }))

  function local(e: { clientX: number; clientY: number }): Point {
    const rect = box.value?.getBoundingClientRect()
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) }
  }

  /** Never pull an edge of the zoomed picture inside its own box. */
  function clamp() {
    const rect = box.value?.getBoundingClientRect()
    if (!rect) return
    const s = scale.value
    tx.value = Math.min(0, Math.max(rect.width * (1 - s), tx.value))
    ty.value = Math.min(0, Math.max(rect.height * (1 - s), ty.value))
  }

  /** Zoom to `next`, keeping the picture point under `at` where it is. */
  function zoomAbout(at: Point, next: number) {
    const s = scale.value
    const c = { x: (at.x - tx.value) / s, y: (at.y - ty.value) / s }
    scale.value = Math.min(MAX_SCALE, Math.max(1, next))
    tx.value = at.x - scale.value * c.x
    ty.value = at.y - scale.value * c.y
    clamp()
  }

  function reset(withAnimation = false) {
    animate.value = withAnimation
    scale.value = 1
    tx.value = 0
    ty.value = 0
  }

  // ─── Pointers ──────────────────────────────────────────────────────────────

  const pointers = new Map<number, Point>()
  /** The picture point under the pinch midpoint, fixed for the pinch's duration. */
  let pinch: { startDist: number; startScale: number; anchor: Point } | null = null
  /** Whether this gesture ever had two fingers down — then it ends in no tap. */
  let wasMulti = false
  let downAt: Point | null = null
  let moved = false
  let lastTap: { at: Point; time: number } | null = null
  let pendingTap: ReturnType<typeof setTimeout> | null = null

  function midpoint(): Point {
    const [a, b] = [...pointers.values()]
    return { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }
  }

  function distance(): number {
    const [a, b] = [...pointers.values()]
    return Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1
  }

  function startPinch() {
    const mid = midpoint()
    pinch = {
      startDist: distance(),
      startScale: scale.value,
      anchor: { x: (mid.x - tx.value) / scale.value, y: (mid.y - ty.value) / scale.value },
    }
  }

  function onPointerDown(e: PointerEvent) {
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    animate.value = false
    pointers.set(e.pointerId, local(e))
    if (pointers.size === 1) {
      downAt = local(e)
      moved = false
      wasMulti = false
    } else if (pointers.size === 2) {
      wasMulti = true
      startPinch()
    }
  }

  function onPointerMove(e: PointerEvent) {
    const prev = pointers.get(e.pointerId)
    if (!prev) return
    const now = local(e)
    pointers.set(e.pointerId, now)
    if (downAt && Math.hypot(now.x - downAt.x, now.y - downAt.y) > TAP_SLOP_PX) moved = true

    if (pointers.size >= 2 && pinch) {
      // Scale from the fingers' spread; position from keeping the anchor under
      // their midpoint — so a pinch that also drifts pans for free.
      const mid = midpoint()
      scale.value = Math.min(
        MAX_SCALE,
        Math.max(1, (pinch.startScale * distance()) / pinch.startDist),
      )
      tx.value = mid.x - scale.value * pinch.anchor.x
      ty.value = mid.y - scale.value * pinch.anchor.y
      clamp()
    } else if (pointers.size === 1 && isZoomed.value) {
      tx.value += now.x - prev.x
      ty.value += now.y - prev.y
      clamp()
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!pointers.delete(e.pointerId)) return
    if (pointers.size === 1) {
      // One finger lifted mid-pinch: the other carries on as a pan.
      pinch = null
      return
    }
    if (pointers.size > 0) return
    pinch = null
    if (scale.value <= 1.01) reset()
    if (!wasMulti && !moved) onTap(local(e))
  }

  function onTap(at: Point) {
    const now = Date.now()
    if (
      lastTap &&
      now - lastTap.time < DOUBLE_TAP_MS &&
      Math.hypot(at.x - lastTap.at.x, at.y - lastTap.at.y) < DOUBLE_TAP_SLOP_PX
    ) {
      lastTap = null
      if (pendingTap) clearTimeout(pendingTap)
      pendingTap = null
      if (isZoomed.value) {
        reset(true)
      } else {
        animate.value = true
        zoomAbout(at, DOUBLE_TAP_SCALE)
      }
      return
    }
    lastTap = { at, time: now }
    if (pendingTap) clearTimeout(pendingTap)
    pendingTap = setTimeout(() => {
      pendingTap = null
      // Zoomed in, a stray tap while panning about must not throw the picture away.
      if (!isZoomed.value) opts.onTap()
    }, DOUBLE_TAP_MS)
  }

  // ─── Wheel ─────────────────────────────────────────────────────────────────
  //
  // A trackpad pinch arrives as a wheel event with ctrlKey set, which is also
  // what ctrl+scroll sends; both zoom. A plain wheel pans once zoomed in, and is
  // left alone otherwise — the viewer uses it to step through the set. Handled
  // events stop here so the viewer never also navigates on them.

  function onWheel(e: WheelEvent) {
    if (e.ctrlKey) {
      e.preventDefault()
      e.stopPropagation()
      animate.value = false
      zoomAbout(local(e), scale.value * Math.exp(-e.deltaY / 100))
      return
    }
    if (!isZoomed.value) return
    e.preventDefault()
    e.stopPropagation()
    animate.value = false
    tx.value -= e.deltaX
    ty.value -= e.deltaY
    clamp()
  }

  function dispose() {
    if (pendingTap) clearTimeout(pendingTap)
    pendingTap = null
    pointers.clear()
    pinch = null
  }

  return {
    style,
    isZoomed,
    reset,
    dispose,
    handlers: {
      pointerdown: onPointerDown,
      pointermove: onPointerMove,
      pointerup: onPointerUp,
      pointercancel: onPointerUp,
      wheel: onWheel,
    },
  }
}
