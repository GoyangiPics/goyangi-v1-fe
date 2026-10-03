import type { Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { effectScope, onScopeDispose, shallowRef } from 'vue'

/**
 * ←/→ steps the set under the cursor, without opening it fullscreen.
 *
 * The set card already has hover-revealed prev/next arrows, so the keys are the
 * obvious next step — but a grid renders dozens of these cards at once and only
 * the hovered one may respond.
 *
 * One listener app-wide, not one per card. Each card registers itself as the
 * active target on mouseenter and stands down on mouseleave, and a single
 * module-level keydown listener dispatches to whoever is current. The alternative
 * — `defineShortcuts` in every card, each guarding on its own hover flag — works,
 * but installs a keydown listener per card, and a page of 48 items would carry 48
 * of them to serve one keystroke.
 */

interface ArrowTarget {
  onPrev: () => void
  onNext: () => void
  /** Consulted at keypress time, so callers can gate on their own live state. */
  isEnabled?: () => boolean
}

/**
 * Whoever the cursor is over. shallowRef because the value is an opaque handler
 * bag — nothing reads through it reactively, it is only ever swapped.
 */
const active = shallowRef<ArrowTarget | null>(null)

let installed = false

/** True while the keystroke belongs to a field the user is typing in. */
function isTypingTarget(): boolean {
  const el = document.activeElement as HTMLElement | null
  return el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || !!el?.isContentEditable
}

function install() {
  if (installed || typeof window === 'undefined') return
  installed = true

  // Detached scope, for the reason useKeyboardShortcuts documents at length: this
  // installs from whichever card mounts first, and useEventListener binds its
  // cleanup to the current component scope — so without detaching, the listener
  // would die with that card, and cards unmount constantly (pagination,
  // filtering, the grouped/ungrouped toggle).
  const scope = effectScope(true)
  scope.run(() => {
    useEventListener(window, 'keydown', (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

      const target = active.value
      if (!target) return
      if (isTypingTarget()) return
      if (target.isEnabled && !target.isEnabled()) return

      // Modified arrows are browser navigation and text selection, not ours.
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return

      // ←/→ scroll horizontally by default. Nothing on this layout scrolls
      // sideways today, but stepping a carousel and nudging the viewport at once
      // would be a strange thing to leave in.
      event.preventDefault()

      if (event.key === 'ArrowLeft') target.onPrev()
      else target.onNext()
    })
  })
}

/**
 * @param el      The element whose hover arms the keys.
 * @param handlers What to call, plus an optional live gate.
 */
export function useHoverArrowKeys(el: Ref<HTMLElement | null>, handlers: ArrowTarget): void {
  install()

  useEventListener(el, 'mouseenter', () => {
    active.value = handlers
  })

  // Identity-checked on the way out: a fast move between two cards can fire the
  // new card's mouseenter before the old card's mouseleave, and clearing
  // unconditionally would disarm the card the cursor is now on.
  const standDown = () => {
    if (active.value === handlers) active.value = null
  }

  useEventListener(el, 'mouseleave', standDown)
  // A card can unmount while hovered — pagination and filtering both replace the
  // grid under the cursor — and would otherwise stay registered as the target
  // forever, stepping a carousel nobody can see.
  onScopeDispose(standDown)
}
