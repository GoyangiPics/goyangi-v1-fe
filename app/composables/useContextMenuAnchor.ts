import { computed, onScopeDispose, ref, watch } from 'vue'

/** What a card holds a `ref` to in order to open a context menu. */
export interface ContextMenuHandle {
  show: (event: Event | { clientX: number; clientY: number }) => void
}

/**
 * State for a context menu anchored to the pointer, for binding to
 * `UDropdownMenu`'s `:content.reference`.
 *
 * Extracted from ContentActionsMenu and SetActionsMenu, which held ~30
 * byte-identical lines each — including the bug below, so a third menu would
 * have copied it again.
 *
 * ## Why the reference is rebuilt on every point change
 *
 * The obvious implementation reads `point.value` only inside the
 * `getBoundingClientRect` closure. That computed then has **no reactive
 * dependency** on `point`: its body just builds an object literal, so it never
 * invalidates, the object identity handed to Floating UI never changes, and a
 * second right-click leaves the menu where it was.
 *
 * Reading `point.value` in the computed *body* is what fixes it. Reka passes
 * `props.reference` into `useFloating`, which watches it with `flush: 'sync'`,
 * so a new object identity synchronously re-runs positioning — whether or not
 * `open` changed.
 *
 * Do NOT "fix" this by toggling `open` false → `nextTick` → true. On macOS the
 * right-click `pointerdown` already dismisses the menu and `contextmenu`
 * reopens it in the same task, so Vue coalesces that pair into no change at
 * all; on Windows/Linux Chrome `contextmenu` fires on mouseup, a later task, so
 * the menu visibly closes and reopens by itself. A toggle-based fix flickers on
 * the platforms that don't need it, and the reactive reference fixes both.
 *
 * The touch path has no such rescue: Reka defers dismissal to a `click` for
 * touch pointers and a long press produces none, so `open` genuinely stays
 * true.
 */
export function useContextMenuAnchor() {
  const open = ref(false)
  const point = ref({ x: 0, y: 0 })

  const reference = computed(() => {
    // Destructured here, in the computed body, on purpose — see above.
    const { x, y } = point.value
    const rect = { width: 0, height: 0, x, y, left: x, right: x, top: y, bottom: y }
    return { getBoundingClientRect: () => rect }
  })

  const { register, unregister } = useActiveContextMenu()
  const handle = {
    hide: () => {
      open.value = false
    },
  }

  function show(event: Event | { clientX: number; clientY: number }) {
    const e = event as { clientX?: number; clientY?: number }
    point.value = { x: e.clientX ?? 0, y: e.clientY ?? 0 }
    register(handle)
    open.value = true
  }

  function hide() {
    open.value = false
  }

  // Neither menu used to unregister, so the module-level registry kept handles
  // to unmounted components alive and "close the other menu" fired at nothing.
  watch(open, (isOpen) => {
    if (!isOpen) unregister(handle)
  })
  onScopeDispose(() => unregister(handle))

  return { open, point, reference, show, hide }
}
