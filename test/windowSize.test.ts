import { describe, expect, it } from 'vitest'
import { MOBILE_BREAKPOINT } from '~/composables/useWindowSize'

/**
 * The hydration hazard this guards, stated as a test because the mechanism is
 * not obvious from the composable alone.
 *
 * VueUse seeds `width` to Infinity when there is no window, so the SERVER always
 * evaluates the desktop branch. A phone's first client render already has the
 * real width. On the SSR'd routes (/set, /single, /collection) that is a
 * structural mismatch — the server emits button labels the phone does not
 * expect — and it is why the bug only ever appeared on mobile, and only on a
 * directly-opened link rather than an in-app navigation.
 */
const isMobileFor = (width: number) => width < MOBILE_BREAKPOINT

describe('isMobile, as the server evaluates it', () => {
  it('reads as desktop on the server, whatever the real device is', () => {
    // This is the value VueUse's useWindowSize starts from with no window.
    expect(isMobileFor(Number.POSITIVE_INFINITY)).toBe(false)
  })

  it('would disagree with a phone on the very first render', () => {
    // 390 is an iPhone's CSS width. Server says desktop, phone says mobile —
    // the divergence the mounted gate closes.
    expect(isMobileFor(390)).toBe(true)
    expect(isMobileFor(390)).not.toBe(isMobileFor(Number.POSITIVE_INFINITY))
  })

  it('agrees with a desktop, which is why that platform never broke', () => {
    expect(isMobileFor(1440)).toBe(isMobileFor(Number.POSITIVE_INFINITY))
  })

  it('treats the breakpoint itself as desktop', () => {
    expect(isMobileFor(MOBILE_BREAKPOINT)).toBe(false)
    expect(isMobileFor(MOBILE_BREAKPOINT - 1)).toBe(true)
  })
})
