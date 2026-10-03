import type { Ref } from 'vue'
import { watch } from 'vue'

/**
 * Dismiss-event guards for a popover that is opened from a dropdown menu
 * item (e.g. the wrench menus' "Edit" panels).
 *
 * Selecting a menu item opens the popover in the same pointer interaction
 * that closes the menu; the menu's close/focus-restore then registers as an
 * "outside" interaction on the freshly-mounted popover and Reka dismisses it
 * instantly. Reka's layer listens on the capture phase, so the trigger can't
 * stop the events — instead, spread these handlers into the popover's
 * `:content` prop to swallow dismiss events for a short window after opening.
 * Normal outside-click dismissal resumes once the window passes.
 */
export function usePopoverDismissGuard(open: Ref<boolean>, windowMs = 400) {
  let openedAt = 0
  watch(open, (isOpen) => {
    if (isOpen) openedAt = Date.now()
  })

  function guard(e: { preventDefault: () => void }) {
    if (Date.now() - openedAt < windowMs) e.preventDefault()
  }

  return {
    onFocusOutside: guard,
    onInteractOutside: guard,
    onPointerDownOutside: guard,
  }
}
