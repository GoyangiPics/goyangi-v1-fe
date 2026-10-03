import type { Ref } from 'vue'
import type { ContextMenuHandle } from './useContextMenuAnchor'
import { onLongPress } from '@vueuse/core'
import { ref } from 'vue'

/**
 * The key held to get the admin menu instead of the normal one.
 *
 * Deliberately undocumented in the shortcuts modal: every entry behind it is
 * destructive or moderation-only, and advertising it to the whole site would
 * invite people to press it and find nothing. Admins are told directly.
 *
 * `x` because the four documented card shortcuts (c/a/l/d) are taken, and it is
 * not a browser or OS chord in combination with a right-click.
 */
export const ADMIN_MENU_KEY = 'x'

/**
 * The caller side of a pointer-anchored context menu: right-click on desktop,
 * long-press on touch.
 *
 * CardUnified, CardBaseContent and CardStackedContent each hand-rolled this,
 * including three separate inline copies of the menu-ref type.
 *
 * A caller that also binds `adminMenuRef` gets a second, hidden menu on the same
 * gesture: hold ADMIN_MENU_KEY while right-clicking. It opens only for admins,
 * and only when the caller actually mounted an admin menu — so every other card
 * behaves exactly as before whoever is signed in.
 *
 * @param target element that opens the menu (usually the card's media area)
 */
export function useContextMenuTrigger(target: Ref<HTMLElement | null>) {
  const menuRef = ref<ContextMenuHandle | null>(null)
  const adminMenuRef = ref<ContextMenuHandle | null>(null)

  const authStore = useAuthStore()
  const { isKeyHeld } = useKeyboardShortcuts()

  function menuFor(): ContextMenuHandle | null {
    if (adminMenuRef.value && authStore.isAdmin && isKeyHeld(ADMIN_MENU_KEY)) {
      return adminMenuRef.value
    }
    return menuRef.value
  }

  onLongPress(target, (event) => {
    menuFor()?.show(event)
  })

  function onContextMenu(event: MouseEvent) {
    event.preventDefault()
    menuFor()?.show(event)
  }

  return { menuRef, adminMenuRef, onContextMenu }
}
