import type { Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { effectScope, onScopeDispose, shallowRef } from 'vue'
import { isFullscreenOpen } from '~/composables/useVideoVisibility'

/**
 * F opens the post under the cursor in fullscreen.
 *
 * Same shape as useHoverArrowKeys, for the same reason: a grid renders dozens of
 * cards and only the hovered one may answer, so each card registers itself on
 * mouseenter and one app-wide listener dispatches to whoever is current.
 */
const active = shallowRef<(() => void) | null>(null)

let installed = false

function isTypingTarget(): boolean {
  const el = document.activeElement as HTMLElement | null
  return el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || !!el?.isContentEditable
}

function install() {
  if (installed || typeof window === 'undefined') return
  installed = true

  // Detached scope: installed by whichever card mounts first, and it must
  // outlive that card (see useHoverArrowKeys).
  const scope = effectScope(true)
  scope.run(() => {
    useEventListener(window, 'keydown', (event: KeyboardEvent) => {
      if (event.key !== 'f' && event.key !== 'F') return
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const open = active.value
      // Already fullscreen (F there would reopen what's on screen), or typing.
      if (!open || isFullscreenOpen() || isTypingTarget()) return
      event.preventDefault()
      open()
    })
  })
}

/**
 * @param el   The element whose hover arms the key (the card's media area).
 * @param open Opens this card's post fullscreen.
 */
export function useHoverFullscreenKey(el: Ref<HTMLElement | null>, open: () => void): void {
  install()

  useEventListener(el, 'mouseenter', () => {
    active.value = open
  })

  // Identity-checked, and cleared on unmount — see useHoverArrowKeys.
  const standDown = () => {
    if (active.value === open) active.value = null
  }
  useEventListener(el, 'mouseleave', standDown)
  onScopeDispose(standDown)
}
