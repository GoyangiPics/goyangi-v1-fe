export default defineNuxtRouteMiddleware((to) => {
  /*
   * Intentionally skip on the server. The SSR'd content pages
   * (/single/*, /set/*, /collection/*) need to render for anonymous crawlers
   * so social previews and search indexing work. Auth is enforced on the
   * client during hydration: signed-out visitors get redirected to /login,
   * sharing a deep link still works for visitors after they sign in (see
   * the `?redirect=` round-trip below).
   */
  if (import.meta.server) return

  const pb = usePocketBase()
  if (pb.authStore.isValid) return

  // Preserve where the visitor was trying to go so we can send them there
  // after login. Avoid redirect-looping if they were already heading to /login.
  if (to.path === '/login') return

  return navigateTo({
    path: '/login',
    query: { redirect: to.fullPath },
  })
})
