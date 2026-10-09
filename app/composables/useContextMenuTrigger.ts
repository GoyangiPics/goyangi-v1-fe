import type { Ref } from 'vue'
import type { ContextMenuHandle } from './useContextMenuAnchor'
import { onLongPress } from '@vueuse/core'
import { ref } from 'vue'

/**
 * The caller side of a pointer-anchored context menu: right-click on desktop,
 * long-press on touch.
 *
 * CardUnified, CardBaseContent and CardStackedContent each hand-rolled this,
 * including three separate inline copies of the menu-ref type.
 *
 * Owner and admin actions used to live in a second menu behind a held key,
 * which no owner ever saw and no phone could open. They're entries in the one
 * menu now (ManageActions), so this only opens it.
 *
 * @param target element that opens the menu (usually the card's media area)
 */
export function useContextMenuTrigger(target: Ref<HTMLElement | null>) {
  const menuRef = ref<ContextMenuHandle | null>(null)

  onLongPress(target, (event) => {
    menuRef.value?.show(event)
  })

  function onContextMenu(event: MouseEvent) {
    event.preventDefault()
    menuRef.value?.show(event)
  }

  return { menuRef, onContextMenu }
}
