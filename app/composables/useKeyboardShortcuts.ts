/**
 * Exposes `activeKey` — the most recently pressed key (lowercased), or null —
 * and `isKeyHeld`, for shortcuts that qualify a pointer gesture rather than
 * replace a click. Wraps VueUse's `useMagicKeys` so we get one shared listener
 * pair app-wide while keeping our existing `activeKey`-based switch statements
 * in cards.
 *
 * Lazily initialized so this module is import-safe under SSR (no `window`
 * access at module load). VueUse's own `useMagicKeys` already pools its
 * listener internally, so calling this from many components is cheap.
 */
import type { ComputedRef } from 'vue'
import { useMagicKeys } from '@vueuse/core'
import { computed, effectScope } from 'vue'

let activeKeyRef: ComputedRef<string | null> | null = null
/** The shared magic-keys state, kept so isKeyHeld can read the whole held set. */
let heldKeys: { current: Set<string> } | null = null

/** Don't fire while the user is typing in an editable field. */
function isTyping(): boolean {
  if (typeof document === 'undefined') return false
  const target = document.activeElement as HTMLElement | null
  return (
    target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || !!target?.isContentEditable
  )
}

export function useKeyboardShortcuts() {
  if (!activeKeyRef) {
    // Initialize inside a DETACHED effect scope. useMagicKeys registers its
    // keydown/keyup listeners via useEventListener, whose cleanup binds to the
    // *current* component scope. As a module singleton this composable is first
    // called from some card, so without a detached scope those listeners would
    // be torn down the moment that card unmounts — and cards unmount constantly
    // (pagination, filtering, grouped/ungrouped toggle). The singleton would
    // then hold a dead `keys` whose `current` never updates again, leaving
    // `activeKey` stuck at null and every held-key shortcut silently broken.
    // A detached scope is never disposed, so the listeners live app-wide.
    const scope = effectScope(true)
    scope.run(() => {
      const keys = useMagicKeys({ reactive: true })
      heldKeys = keys as unknown as { current: Set<string> }
      activeKeyRef = computed<string | null>(() => {
        if (isTyping()) return null
        const last = [...keys.current].at(-1)
        return last ? last.toLowerCase() : null
      })
    })
  }

  /**
   * Whether `key` is down right now.
   *
   * Distinct from `activeKey`, which is only the LAST key pressed — fine for
   * "hold C and click", useless the moment a shortcut has to survive another
   * key landing after it. Read imperatively from an event handler, not from a
   * computed, so it needs no reactivity of its own.
   */
  function isKeyHeld(key: string): boolean {
    if (!heldKeys || isTyping()) return false
    const wanted = key.toLowerCase()
    return [...heldKeys.current].some((k) => k.toLowerCase() === wanted)
  }

  return { activeKey: activeKeyRef!, isKeyHeld }
}
