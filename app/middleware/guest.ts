export default defineNuxtRouteMiddleware((to) => {
  /*
   * Keeps already-authenticated users off the pre-auth pages (login,
   * register, reset-password) — landing there logged in makes no sense, and
   * submitting the register form would silently swap the active session for a
   * brand-new account. The inverse of auth.ts.
   *
   * Client-only for the same reason as auth.ts: PocketBase stores its token in
   * localStorage, so the request-scoped server instance has no auth context
   * and would always treat the visitor as logged out.
   */
  if (import.meta.server) return

  const pb = usePocketBase()
  if (!pb.authStore.isValid) return

  // Honor a same-origin `?redirect=` (rejecting absolute / protocol-relative
  // URLs, as useAuthRedirect does), otherwise send them home.
  const raw = to.query.redirect
  const target = typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
  return navigateTo(target)
})
