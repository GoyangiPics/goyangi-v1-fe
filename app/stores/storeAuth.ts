import type { Uploader } from '~/types/appTypes'
import { computed, ref } from 'vue'

export const useAuthStore = defineStore('authStore', () => {
  const pb = usePocketBase()

  // State — `user` is the source of truth; everything else derives from it
  // or from `pb.authStore`.
  const user = ref(pb.authStore.record)
  const uploader = ref<Uploader | null>(null)

  const isValid = computed(() => !!user.value)

  /**
   * `user` is an untyped RecordModel, so reading these off it works only by
   * luck of untyped access. One getter each, so consumers don't each re-derive
   * them (uploads.vue had its own copy of canUpload).
   */
  const canUpload = computed(() => !!user.value?.canUpload)
  const isAdmin = computed(() => !!user.value?.isAdmin)

  /**
   * Bumped by logout so a refresh that was already in flight can tell its
   * session is gone. See refreshSession.
   */
  let sessionEpoch = 0
  let refreshRequested = false

  const authRefreshKey = 'authStore:authRefresh'

  /**
   * pb.authStore.record is a snapshot cached at sign-in time, so any field
   * added to `users` after a session started is missing from it — isAdmin would
   * read false for every existing session until logout. One refresh per page
   * load fixes that up, and picks up canUpload grants that previously required
   * signing out and back in.
   *
   * This must NOT be called from the onChange handler: authRefresh ends in
   * authStore.save(), save() always fires onChange, and refreshing from there
   * would re-enter this immediately — an unbounded auth-refresh request loop.
   */
  async function refreshSession() {
    if (!import.meta.client || refreshRequested || !pb.authStore.isValid) return
    refreshRequested = true

    const epoch = sessionEpoch
    try {
      await pb.collection('users').authRefresh({ requestKey: authRefreshKey })
      // A logout while the request was open leaves us holding a response that
      // has already re-saved the old token — authResponse() does that before we
      // get control back, resurrecting the session in localStorage. Undo it.
      if (epoch !== sessionEpoch) pb.authStore.clear()
    } catch (error: any) {
      // 401/403 means the token is dead. Nothing else clears it, and leaving it
      // in localStorage renders a signed-in UI whose every request fails.
      // Aborts (status 0) and network blips must not sign anyone out.
      if (error?.status === 401 || error?.status === 403) pb.authStore.clear()
    }
  }

  // Actions
  async function syncFromPb() {
    user.value = pb.authStore.record
    if (user.value) await fetchUploader()
    else uploader.value = null
  }

  async function login(email: string, password: string) {
    await pb.collection('users').authWithPassword(email, password)
    await syncFromPb()
  }

  async function register(email: string, password: string, passwordConfirm: string) {
    await pb.collection('users').create({ email, password, passwordConfirm })
    await pb.collection('users').authWithPassword(email, password)
    await syncFromPb()
  }

  async function loginWithOAuth(providerType: string) {
    await pb.collection('users').authWithOAuth2({ provider: providerType })
    await syncFromPb()
  }

  /**
   * Every path that ends a session goes through here. Order matters: invalidate
   * the epoch and abort the refresh before clearing, so an in-flight refresh can
   * neither complete nor be believed if it lands anyway.
   */
  function clearSession() {
    sessionEpoch++
    pb.cancelRequest(authRefreshKey)
    pb.authStore.clear()
  }

  async function logout() {
    clearSession()
    // Stars scope /me/feed, so they must not survive into the next session on a
    // shared browser. storeStars also guards this on hydrate, belt and braces.
    useStarsStore().clear()
    await syncFromPb()
  }

  async function fetchUploader() {
    if (!user.value) return
    try {
      uploader.value = await pb
        .collection('uploaders')
        .getFirstListItem<Uploader>(pb.filter('user={:id}', { id: user.value.id }), {
          requestKey: null,
        })
    } catch (error: any) {
      // 404 just means this user has no uploader profile yet — expected.
      if (error?.status !== 404) console.error('Error fetching uploader details:', error)
      uploader.value = null
    }
  }

  async function createUploader(name: string) {
    if (!user.value) return
    uploader.value = await pb.collection('uploaders').create<Uploader>({
      name: name.trim(),
      user: user.value.id,
    })
  }

  async function updateUploaderName(name: string) {
    if (!uploader.value) return
    uploader.value = await pb.collection('uploaders').update<Uploader>(uploader.value.id, {
      name: name.trim(),
    })
  }

  async function updateUserAvatar(file: File) {
    if (!user.value) return
    const formData = new FormData()
    formData.append('avatar', file)
    const record = await pb.collection('users').update(user.value.id, formData)
    pb.authStore.save(pb.authStore.token, record)
    user.value = record
  }

  async function deleteAccount() {
    if (!user.value) return
    await pb.collection('users').delete(user.value.id)
    clearSession()
    await syncFromPb()
  }

  // Initialize and subscribe to auth changes (client only — server has a
  // fresh per-request PocketBase instance with no persisted auth).
  //
  // The microtask resync is defensive: on SSR routes, Pinia hydrates the
  // store from `nuxtApp.payload.pinia` which contains the server's
  // signed-out state (user=null). That hydration runs after the factory,
  // so without re-syncing we'd render briefly logged-out on the client.
  if (import.meta.client) {
    syncFromPb()
    queueMicrotask(syncFromPb)
    pb.authStore.onChange(() => {
      syncFromPb()
    })
    refreshSession()
  }

  return {
    user,
    uploader,
    isValid,
    canUpload,
    isAdmin,
    login,
    register,
    loginWithOAuth,
    logout,
    createUploader,
    updateUploaderName,
    updateUserAvatar,
    deleteAccount,
  }
})
