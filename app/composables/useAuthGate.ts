/**
 * Gate for actions that need a signed-in user.
 *
 * `/set/[id]`, `/single/[id]` and `/tools/*` are reachable without an account,
 * but the mutating actions on them (like, add to collection, report, save a
 * filter, share an imgur link) still write to PocketBase as a user. Rather
 * than failing silently, they prompt for login and bail out.
 *
 * Every other page stays behind the `auth` middleware, so the gate is a
 * no-op there — the guard is still applied at the shared card / dialog level
 * because those components render on both kinds of page.
 */
export function useAuthGate() {
  const authStore = useAuthStore()
  const toast = useToast()
  const route = useRoute()
  const router = useRouter()

  /**
   * Returns true when the visitor is signed in. Otherwise shows a toast with
   * a "Log in" action that round-trips back here via `?redirect=`, and
   * returns false so callers can early-return.
   *
   * `action` completes the sentence "Log in to …".
   */
  function requireAuth(action = 'do that'): boolean {
    if (authStore.isValid) return true

    toast.add({
      title: "You're not logged in",
      description: `Log in to ${action}.`,
      icon: 'i-lucide-lock',
      color: 'info',
      duration: 4000,
      actions: [
        {
          label: 'Log in',
          color: 'neutral',
          variant: 'outline',
          onClick: () => {
            router.push({ path: '/login', query: { redirect: route.fullPath } })
          },
        },
      ],
    })

    return false
  }

  return { requireAuth }
}
