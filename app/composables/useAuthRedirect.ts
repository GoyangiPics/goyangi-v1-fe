/**
 * Resolves the post-auth redirect target from `?redirect=`, rejecting
 * absolute and protocol-relative URLs to prevent open-redirect attacks —
 * only same-origin paths are honored. Shared by login and register.
 */
export function useAuthRedirect() {
  const route = useRoute()

  function redirectTarget(): string {
    const raw = route.query.redirect
    if (typeof raw !== 'string') return '/'
    if (!raw.startsWith('/') || raw.startsWith('//')) return '/'
    return raw
  }

  return { redirectTarget }
}
