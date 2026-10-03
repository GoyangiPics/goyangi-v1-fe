/**
 * Thin wrapper around VueUse's `useWindowSize` that adds an `isMobile`
 * helper. VueUse already shares one resize listener across all callers, so
 * the heavy lifting (debouncing, listener pooling) is theirs.
 */
import { useMounted, useWindowSize as vueUseWindowSize } from '@vueuse/core'
import { computed } from 'vue'

export const MOBILE_BREAKPOINT = 712

export function useWindowSize() {
  const { width } = vueUseWindowSize()

  /**
   * `isMobile` stays false until mount, so the first client render can't
   * disagree with the server's.
   *
   * VueUse seeds `width` to Infinity when there is no window and then calls its
   * update() SYNCHRONOUSLY during setup — so the server renders with Infinity
   * (isMobile false) while a phone's very first render already has the real
   * width (isMobile true). On `/set/**`, `/single/**` and `/collection/**`,
   * which are the routes opted into SSR, that is a structural hydration
   * mismatch: the server emits the desktop header with its button labels and
   * the phone expects the label-less mobile one. Desktop matched by luck —
   * Infinity and a real desktop width both read as not-mobile — which is why
   * this only ever showed up on a phone, and only on a link opened directly
   * rather than navigated to.
   *
   * `useMounted` is false during SSR and during hydration, flipping in
   * onMounted, so both renders agree and the real value lands immediately
   * after. `width` itself is deliberately NOT gated: useResponsiveColumns wants
   * it as early as possible, and the grid it sizes is never server-rendered
   * (items are fetched on mount, so SSR only ever emits the spinner).
   */
  const mounted = useMounted()
  const isMobile = computed(() => mounted.value && width.value < MOBILE_BREAKPOINT)

  return { isMobile, width }
}
