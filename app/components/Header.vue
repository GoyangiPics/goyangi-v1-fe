<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const router = useRouter()
const route = useRoute()
const toast = useToast()

const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const avatar = useAvatarUrl()
const appVersion = useRuntimeConfig().public.appVersion

const avatarUrl = computed(() => avatar.forUser(authStore.user))

const filtersStore = useFiltersStore()
// Menu entries that lead to a filterable listing carry the active filters, the
// same way the nav tabs do; the rest go bare. See useNavTarget.
const { to } = useNavTarget()

/**
 * The logo is the "start over" control: it clears every filter and returns to
 * page 1, rather than carrying the current query home.
 *
 * It used to preserve everything but `page`, so clicking it from a filtered view
 * landed on a filtered home — indistinguishable from the filters being stuck.
 * Still a real link to `/`, so middle-click and open-in-new-tab keep working;
 * the reset runs before the navigation resolves, and index.vue's query watcher
 * refetches when the query empties.
 *
 * That last part is why every filter dimension has to be in the URL, the search
 * term included (see serializeFiltersToQuery). While it wasn't, a search-only
 * view already had an empty query, so this link resolved to the route we were
 * on: no navigation, no query transition, no refetch — the box emptied and the
 * results stayed filtered.
 */
function resetToHome() {
  filtersStore.reset()
}

const loginRoute = computed(() => ({
  path: '/login',
  query: route.path === '/login' ? {} : { redirect: route.fullPath },
}))

const shortcutsVisible = ref(false)
// computed, not ref: the "New Upload" entry is gated on canUpload, which only
// resolves once client-side auth state has synced.
// Navigation entries carry `to` rather than an onSelect that pushes: the menu
// renders them as real anchors, so they can be middle-clicked or opened in a
// new tab. Only the actions (settings, shortcuts, logout) keep onSelect.
const items = computed<DropdownMenuItem[][]>(() => [
  // Uploading is an action, not a library view, and it's the one entry here that
  // not every account has — its own group rather than a conditional tail on
  // Library, which read as "one of my things" and vanished without a trace.
  ...(authStore.canUpload
    ? [
        [
          { type: 'label' as const, label: 'Upload' },
          {
            label: 'New upload',
            icon: 'i-lucide-cloud-upload',
            to: '/uploads',
          },
        ],
      ]
    : []),
  [
    { type: 'label', label: 'Library' },
    {
      label: 'My feed',
      icon: 'i-lucide-star',
      to: to('/me/feed'),
    },
    {
      label: 'My likes',
      icon: 'i-lucide-heart',
      to: to('/me/likes'),
    },
    {
      label: 'My collections',
      icon: 'i-lucide-images',
      to: to('/me/collections'),
    },
    {
      label: 'My uploads',
      icon: 'i-lucide-square-pen',
      to: to('/me/uploads'),
    },
    {
      label: 'My sets',
      icon: 'i-lucide-film',
      to: to('/me/sets'),
    },
  ],
  [
    { type: 'label', label: 'App' },
    // Every browse surface in one place. /singles and /sets are both otherwise
    // orphan routes — in no nav at all — and /sets is now the admin merge
    // surface, so they need a way in that isn't a sixth main nav tab.
    {
      label: 'Browse posts',
      icon: 'i-lucide-image',
      to: to('/singles'),
    },
    {
      label: 'Browse sets',
      icon: 'i-lucide-film',
      to: to('/sets'),
    },
    {
      label: 'Browse collections',
      icon: 'i-lucide-folder',
      to: to('/collections'),
    },
    {
      label: 'Browse labels',
      icon: 'i-lucide-tag',
      to: '/labels',
    },
    {
      label: 'Browse stickers',
      icon: 'i-lucide-smile',
      to: '/stickers',
    },
    {
      label: 'Browse uploaders',
      icon: 'i-lucide-users',
      to: '/uploaders',
    },
  ],
  [
    { type: 'label', label: 'Tools' },
    {
      label: 'Settings',
      icon: 'i-lucide-settings',
      onSelect: () => {
        settingsStore.isSettingsOpen = true
      },
    },
    {
      label: 'Imgur tools',
      icon: 'i-lucide-wrench',
      to: '/tools',
    },
    {
      label: 'GIF tools',
      icon: 'i-lucide-zap',
      to: '/tools/gif',
    },
    {
      label: 'Keyboard shortcuts',
      icon: 'i-lucide-keyboard',
      onSelect: () => {
        shortcutsVisible.value = true
      },
    },
  ],
  [
    { type: 'label', label: 'Account' },
    ...(authStore.isAdmin
      ? [{ label: 'Admin', icon: 'i-lucide-shield', to: '/admin', slot: 'admin' as const }]
      : []),
    {
      label: 'My profile',
      icon: 'i-lucide-user',
      to: '/me/profile',
    },
    {
      label: 'Log out',
      icon: 'i-lucide-log-out',
      onSelect: async () => {
        // Await it: logout tears the session down before the first await, but
        // navigating only once it has fully settled keeps /login from briefly
        // rendering against a half-cleared store.
        await authStore.logout()
        router.push('/login')
      },
    },
  ],
])

// Open reports, badged on the Admin entry. One count query when someone turns
// out to be an admin; /admin itself is where they're worked through.
const openReports = ref(0)
const pb = usePocketBase()
watch(
  () => authStore.isAdmin,
  async (isAdmin) => {
    if (!import.meta.client || !isAdmin) return
    try {
      const page = await pb
        .collection('contents_reports')
        .getList(1, 1, { fields: 'id', requestKey: 'header_open_reports' })
      openReports.value = page.totalItems
    } catch {
      // Just a badge.
    }
  },
  { immediate: true },
)

function showComingSoon() {
  toast.add({
    title: 'Coming soon',
    description: "You'll be able to support Goyangi soon.",
    color: 'info',
    duration: 3000,
  })
}
</script>

<template>
  <!-- px-4 mirrors main's, because this sits OUTSIDE main: without it the header
       would span the layout and sit 32px wider than the grid on both sides. The
       point is for it to line up with the grid below, not to be inset from it. -->
  <div class="flex justify-between items-center select-none px-4">
    <div />
    <div :class="{ 'pl-13': authStore.isValid }">
      <div class="relative inline-flex flex-col items-center">
        <!-- Version Div -->
        <div class="absolute bottom-4 right-0 bg-black text-xs p-1 rounded-lg opacity-75">
          {{ appVersion }}
        </div>
        <!-- Logo -->
        <NuxtLink to="/" class="inline-block" @click="resetToHome">
          <img
            src="~/assets/images/goyangi.webp"
            width="200"
            alt="Goyangi home"
            class="cursor-pointer"
          />
        </NuxtLink>
        <!-- Additional Info -->
        <div>
          <p class="block text-center text-sm text-night-600 mt-4">
            goyangi · K-pop pics, gifs and videos to browse, like and collect.
          </p>
        </div>
      </div>
    </div>

    <div class="card flex justify-center">
      <!--
        ClientOnly because auth state is client-only (PB stores tokens in
        localStorage; the request-scoped server PB instance has no idea who
        the visitor is). Rendering this server-side would always show the
        signed-out state, which then mismatches once the client hydrates
        with a real user.
      -->
      <ClientOnly>
        <div v-if="authStore.isValid">
          <UDropdownMenu :items="items">
            <template #admin-trailing>
              <UBadge v-if="openReports" :label="openReports" color="error" size="sm" />
            </template>
            <UAvatar
              :src="avatarUrl ?? undefined"
              :icon="avatarUrl ? undefined : 'i-lucide-user'"
              class="hover:brightness-140 transition duration-300 cursor-pointer"
              style="background-color: var(--color-night-800)"
              :ui="{ root: 'size-16', icon: 'size-8' }"
            />
          </UDropdownMenu>
        </div>
        <!--
          Browsing is open to anonymous visitors, so the avatar slot doubles as
          the sign-in entry point. `?redirect=` sends them back where they were.
        -->
        <UButton
          v-else
          icon="i-lucide-log-in"
          label="Log in"
          color="neutral"
          variant="outline"
          class="nav-pill-outline"
          :to="loginRoute"
        />
      </ClientOnly>
    </div>
  </div>
  <UModal
    v-model:open="shortcutsVisible"
    title="Keyboard shortcuts"
    :ui="{ content: 'sm:max-w-sm' }"
  >
    <template #body>
      <p class="text-sm text-night-400 mb-4">Hold a key and click a post.</p>
      <div class="flex flex-col gap-3">
        <div
          v-for="shortcut in [
            { key: 'C', icon: 'i-lucide-copy', label: 'Copy image link' },
            { key: 'A', icon: 'i-lucide-folder-plus', label: 'Add to collection' },
            { key: 'L', icon: 'i-lucide-heart', label: 'Like or unlike' },
            { key: 'D', icon: 'i-lucide-download', label: 'Download' },
          ]"
          :key="shortcut.key"
          class="flex items-center gap-3"
        >
          <kbd
            class="inline-flex items-center justify-center w-7 h-7 rounded bg-night-700 text-white text-xs font-bold font-mono border border-night-600 shrink-0"
          >
            {{ shortcut.key }}
          </kbd>
          <UIcon :name="shortcut.icon" class="text-night-400 text-sm shrink-0" />
          <span class="text-sm text-night-200">{{ shortcut.label }}</span>
        </div>
      </div>

      <!-- This modal is where the app documents its hidden interactions, so the
           hold gesture belongs here — the context-menu entry is the discoverable
           path, this is the shortcut. -->
      <p class="text-sm text-night-400 mt-6 mb-4">Gestures</p>
      <div class="flex items-center gap-3">
        <kbd
          class="inline-flex items-center justify-center px-2 h-7 rounded bg-night-700 text-white text-xs font-bold font-mono border border-night-600 shrink-0"
        >
          Hold
        </kbd>
        <UIcon name="i-lucide-heart" class="text-night-400 text-sm shrink-0" />
        <span class="text-sm text-night-200">
          Hold the like button for 1.5s to like the whole set
        </span>
      </div>
    </template>
  </UModal>

  <div class="flex justify-center items-center gap-4 text-night-400 mt-0.5">
    <NuxtLink to="/terms" class="text-center text-xs hover:text-cyan-600"> Terms </NuxtLink>
    <NuxtLink to="/privacy" class="text-center text-xs hover:text-cyan-600"> Privacy </NuxtLink>
    <!-- No Takedown link here: it is linked from Terms (§10, §11) and the About
         page's contact block, which is where someone with a removal request
         looks. Privacy stays — it has to be one click from every page. -->
    <NuxtLink to="/about" class="text-center text-xs hover:text-cyan-600"> About </NuxtLink>
    <button
      type="button"
      class="text-center text-xs hover:text-cyan-600 cursor-pointer bg-transparent border-0"
      @click="showComingSoon"
    >
      Donate
    </button>
    <a
      href="https://selca.kastden.org/kpop/"
      target="_blank"
      rel="noopener"
      class="underline text-center text-xs hover:text-cyan-600"
    >
      selca.kastden.org
    </a>
  </div>
</template>
