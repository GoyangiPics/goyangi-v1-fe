<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { UploaderStat } from '~/types/appTypes'

useHead({ title: 'Uploaders' })

definePageMeta({
  middleware: ['auth'],
})

const pb = usePocketBase()
const avatar = useAvatarUrl()
const authStore = useAuthStore()

interface UploaderEntry {
  id: string
  name: string
  created: string
  avatarUrl: string | null
  uploadCount: number
  /** The linked account's name, when there is one. Discord-minted records have none. */
  userName: string | null
  aliases: string
}

const entries = ref<UploaderEntry[]>([])
const isLoading = ref(true)
const searchTerm = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

function onSearchClick() {
  searchInputRef.value?.blur()
}

/**
 * One request: the `uploaders_stats` view carries each profile with its
 * upload count (stickers excluded, matching the profile page's total).
 *
 * This used to be a getFullList of `uploaders` followed by one `contents`
 * count query PER uploader, all at once from a Promise.all. Fine at the ~30
 * uploaders it was written for; at 400+ it was 400+ concurrent count queries,
 * each walking every content row on the server — opening this page stalled
 * the whole site. The count now lives in the view, and the backend keeps the
 * index that makes it cheap.
 */
async function loadUploaders() {
  isLoading.value = true
  try {
    const uploaders = await pb.collection('uploaders_stats').getFullList<UploaderStat>({
      sort: 'name',
      expand: 'user',
      // Its own key, like the profile page's lookup — see the note in
      // storeReference. A view has its own path so it cannot collide with the
      // reference store's `uploaders` load, but an explicit key costs nothing
      // and keeps that from ever becoming load-bearing.
      requestKey: 'uploaders_directory',
    })

    entries.value = uploaders.map((u) => ({
      id: u.id,
      name: u.name ?? '',
      created: u.created,
      avatarUrl: avatar.forUploader(u),
      uploadCount: u.uploads ?? 0,
      // `expand: 'user'` above is what makes this available; an uploader minted
      // by the Discord bot has no `user` at all.
      userName: u.expand?.user?.name || null,
      aliases: u.aliases ?? '',
    }))
  } catch (e: any) {
    if (!e?.isAbort) console.error('Failed to load uploaders:', e)
  } finally {
    isLoading.value = false
  }
}

const filteredEntries = computed(() => {
  const t = searchTerm.value.trim().toLowerCase()
  if (!t) return entries.value
  return entries.value.filter((e) => e.name.toLowerCase().includes(t))
})

function formatJoined(date: string): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
}

// ─── Admin: merging duplicate profiles ──────────────────────────────────────
// One person using both ingest doors becomes two uploaders (see
// useMergeUploaders). This page is where that is visible — it already lists every
// profile with its upload count — so it is where the repair belongs.

// Selection tracks the FILTERED rows: acting on a profile the search has hidden
// is exactly the mistake this page makes easy.
const selection = useRowSelection(() => filteredEntries.value, {
  keyOf: (entry: UploaderEntry) => entry.id,
  // No renditions on an uploader — this composable's copy-links half is unused
  // here; it is the selection half that is wanted.
  linksOf: () => [],
})

const selectedUploaders = computed(() => filteredEntries.value.filter(selection.isSelected))

const isMergeVisible = ref(false)
const canMerge = computed(() => authStore.isAdmin && selectedUploaders.value.length >= 2)

function openMerge() {
  isMergeVisible.value = true
}

async function onMerged() {
  selection.clear()
  await loadUploaders()
}

onMounted(loadUploaders)
</script>

<template>
  <div>
    <div class="mx-auto my-2 flex">
      <div
        class="filter-input-wrapper relative flex-1 flex items-center flex-wrap gap-1.5 pl-10 pr-2 py-1 min-h-[2rem]"
      >
        <UIcon
          name="i-lucide-search"
          class="absolute top-1/2 -translate-y-1/2 left-3 text-night-400 dark:text-night-600"
        />
        <input
          ref="searchInputRef"
          v-model="searchTerm"
          type="text"
          placeholder="Search uploaders…"
          class="filter-input flex-1 min-w-30 bg-transparent outline-none border-0 text-sm py-1"
        />
        <div v-if="searchTerm" class="ml-auto flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            class="flex items-center justify-center w-6 h-6 rounded-full text-red-400 hover:bg-red-900/40 transition-colors cursor-pointer"
            aria-label="Clear search"
            @click="searchTerm = ''"
          >
            <UIcon name="i-lucide-x" class="text-xs" />
          </button>
        </div>
      </div>
      <UButton
        label="Search"
        class="ml-2 w-36"
        color="neutral"
        variant="solid"
        @click="onSearchClick"
      />
    </div>

    <NavigationBase />

    <div class="mt-4">
      <PageHeader emoji="🎨" title="Uploaders" :total="entries.length" total-label="uploaders" />
    </div>

    <div v-if="isLoading" class="flex justify-center items-center mt-16">
      <LoadingSpinner />
    </div>

    <div v-else-if="filteredEntries.length === 0" class="flex justify-center items-center mt-16">
      <h1 class="text-2xl text-night-400">No uploaders found.</h1>
    </div>

    <template v-else>
      <SelectionActionBar
        v-if="authStore.isAdmin"
        :selected-count="selection.selectedCount.value"
        @clear="selection.clear"
      >
        <template #actions>
          <UTooltip
            :text="canMerge ? 'Merge selected profiles' : 'Select at least two profiles'"
            :content="{ side: 'top' }"
          >
            <UButton
              icon="i-lucide-merge"
              label="Merge selected"
              size="xs"
              color="primary"
              :disabled="!canMerge"
              @click="openMerge"
            />
          </UTooltip>
        </template>
      </SelectionActionBar>

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <!-- The checkbox is a SIBLING of the card, not a child: the whole card is
             a link, and a checkbox inside it would depend on cancelling the
             navigation to avoid opening the profile on every tick. -->
        <div v-for="entry in filteredEntries" :key="entry.id" class="relative">
          <UCheckbox
            v-if="authStore.isAdmin"
            :model-value="selection.isSelected(entry)"
            size="sm"
            class="absolute top-2 left-2 z-10"
            :aria-label="`Select ${entry.name || entry.id}`"
            @update:model-value="selection.toggle(entry)"
          />
          <NuxtLink
            :to="`/uploaders/${encodeURIComponent(entry.name)}`"
            class="glass-card h-full p-4 flex flex-col items-center text-center gap-2 transition-all duration-200 hover:border-pink-500/40 hover:-translate-y-0.5 group"
            :class="selection.isSelected(entry) ? 'border-pink-500/60! bg-pink-500/5' : ''"
          >
            <div
              class="w-20 h-20 rounded-full overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0 group-hover:border-pink-400/40 transition-colors"
            >
              <img
                v-if="entry.avatarUrl"
                :src="entry.avatarUrl"
                :alt="entry.name"
                class="w-full h-full object-cover"
              />
              <UIcon v-else name="i-lucide-user" class="text-night-500 text-2xl" />
            </div>
            <p class="text-sm font-semibold text-night-100 truncate w-full" :title="entry.name">
              {{ entry.name || 'Unnamed' }}
            </p>
            <div class="flex items-center gap-1.5 text-xs text-pink-300 font-mono">
              <UIcon name="i-lucide-cloud-upload" class="text-xs" />
              <span>{{ entry.uploadCount }} post{{ entry.uploadCount === 1 ? '' : 's' }}</span>
            </div>
            <p class="text-xs text-night-500 font-mono">since {{ formatJoined(entry.created) }}</p>
            <!-- Only for admins, and only where it means something: an uploader
                 with no account is the Discord-minted half of a duplicate pair,
                 and spotting it is the whole job on this page. -->
            <UBadge
              v-if="authStore.isAdmin && !entry.userName"
              icon="i-lucide-unlink"
              color="neutral"
              variant="soft"
              label="No account"
              class="select-none text-xs!"
            />
          </NuxtLink>
        </div>
      </div>
    </template>

    <DialogAdminMergeUploaders
      v-if="isMergeVisible && canMerge"
      :is-visible="isMergeVisible"
      :uploaders="selectedUploaders"
      @update:is-visible="isMergeVisible = $event"
      @merged="onMerged"
    />
  </div>
</template>
