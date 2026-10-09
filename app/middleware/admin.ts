export default defineNuxtRouteMiddleware(() => {
  // Client-only, like auth.ts: the server has no idea who the visitor is. This
  // is a convenience, not the gate — the API rules refuse non-admins anyway.
  if (import.meta.server) return

  /*
   * Read from pb.authStore, not useAuthStore().isAdmin. On a hard load, Pinia
   * hydrates the store with the server's signed-out state and only resyncs a
   * microtask later (see storeAuth), so the store can say "not an admin" for an
   * admin who opened /admin directly.
   */
  const pb = usePocketBase()
  if (pb.authStore.isValid && pb.authStore.record?.isAdmin) return

  return navigateTo('/')
})
