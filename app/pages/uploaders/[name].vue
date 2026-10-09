<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { MostLikedModes } from '~/types/typesFilters'

definePageMeta({
  middleware: ['auth'],
  // Kept alive so back from a /single/ page is instant with the scroll intact —
  // the SPA's version of bfcache. Capped: a cached page keeps its whole grid.
  // useContentListing guards its watchers for this; see the KeepAlive note there.
  keepalive: { max: 10 },
})

const route = useRoute()
const pb = usePocketBase()
const filtersStore = useFiltersStore()
const avatar = useAvatarUrl()

const {
  items,
  itemsTotal,
  isLoading,
  columns,
  firstItemIndex,
  pageSize,
  changePage,
  refresh,
  onFiltersSettingsApply,
  fetchAllMatching,
} = useContentListing('uploaderContents')

// Select mode for admins: bulk moderation straight from the listing.
const authStore = useAuthStore()
const { selecting, isSelectingAll, selection, toggleSelecting, selectAll, onProcessed } =
  useBulkSelect(() => items.value as any[], {
    fetchAll: fetchAllMatching as () => Promise<any[]>,
    refresh: () => refresh(),
  })

const uploaderName = computed(() => decodeURIComponent(route.params.name as string))
const uploader = ref<any>(null)
const uploaderNotFound = ref(false)

async function loadUploader() {
  try {
    const records = await pb.collection('uploaders').getFullList({
      filter: pb.filter('name={:name}', { name: uploaderName.value }),
      expand: 'user',
      // A key of its own, because the SDK's default is method+path with the
      // query string ignored — so this shared one key with the reference
      // store's `uploaders` load, which useContentListing kicks off from an
      // earlier onMounted on the same tick. A new request aborts the pending
      // one holding its key, so this cancelled that load, ensureLoaded()
      // rejected, and loadInitial threw before it ever reached fetchItems:
      // isLoading starts true, so a cold visit to this page spun forever while
      // in-app navigation (where ensureLoaded is already a no-op) was fine.
      requestKey: 'uploader_profile',
    })
    if (records.length > 0) uploader.value = records[0]
    else uploaderNotFound.value = true
  } catch (e) {
    console.error('Failed to load uploader:', e)
    uploaderNotFound.value = true
  }
}

const avatarUrl = computed(() => (uploader.value ? avatar.forUploader(uploader.value) : null))
const joinedAt = computed(() => {
  if (!uploader.value?.created) return ''
  return new Date(uploader.value.created).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

useSeoMeta({
  ogSiteName: '🐱 goyangi.pics',
  ogTitle: computed(() => `${uploaderName.value} — Uploader`),
  ogDescription: computed(() => `Uploads by ${uploaderName.value}`),
  ogType: 'website',
  twitterCard: 'summary',
})

const { isMobile } = useWindowSize()

// Derived from the store, not a local boolean.
//
// `mostLikedMode` is persisted and can be cleared from elsewhere — the logo's
// reset, the filter bar's Reset — so a separate flag drifts out of step with the
// very filter it describes. It started false on every mount while the filter was
// still on, which rendered the button active over a collapsed row and made the
// next click OPEN rather than close.
const isMostLikedRowVisible = computed(() => !!filtersStore.mostLikedMode)

async function likedRowToggle() {
  if (isMostLikedRowVisible.value) filtersStore.reset()
  else filtersStore.setMostLikedMode(MostLikedModes.AllTime)
  await onFiltersSettingsApply()
}

onMounted(loadUploader)
</script>

<template>
  <div>
    <Filterbar @search="onFiltersSettingsApply" @filters-apply="onFiltersSettingsApply" />

    <div class="flex justify-start items-center">
      <NavigationBase class="flex-1" />
      <UButton
        :label="isMobile ? 'Top' : 'Top posts'"
        :icon="filtersStore.mostLikedMode ? 'i-lucide-chevrons-up' : 'i-lucide-chevrons-down'"
        color="info"
        class="ml-2"
        @click="likedRowToggle"
      />
    </div>

    <div v-if="isMostLikedRowVisible">
      <MostLikedRow @filters-apply="onFiltersSettingsApply" />
    </div>

    <div class="mt-4">
      <div class="flex items-center gap-3 mb-4">
        <div
          class="w-8 h-8 rounded-full overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0"
        >
          <img
            v-if="avatarUrl"
            :src="avatarUrl"
            :alt="uploaderName"
            class="w-full h-full object-cover"
          />
          <UIcon v-else name="i-lucide-user" class="text-night-500" />
        </div>
        <h1 class="text-xl font-semibold text-night-100">
          {{ uploaderName }}
        </h1>
        <span class="text-xs text-night-500 font-mono mt-0.5">
          {{ itemsTotal }} post{{ itemsTotal === 1 ? '' : 's' }}
        </span>
        <span v-if="joinedAt" class="text-xs text-night-500 font-mono mt-0.5">
          joined {{ joinedAt }}
        </span>
        <UButton
          v-if="authStore.isAdmin"
          class="ml-auto"
          :icon="selecting ? 'i-lucide-check' : 'i-lucide-square-check'"
          :label="isMobile ? undefined : selecting ? 'Done' : 'Select'"
          color="neutral"
          :variant="selecting ? 'solid' : 'outline'"
          @click="toggleSelecting"
        />
      </div>
    </div>

    <div v-if="uploaderNotFound" class="flex justify-center items-center mt-16">
      <h1 class="text-2xl text-night-400">Uploader not found.</h1>
    </div>
    <div v-else-if="isLoading === true">
      <div class="flex justify-center items-center mt-16">
        <LoadingSpinner />
      </div>
    </div>
    <ContentGrid v-else-if="items.length !== 0" :columns="columns">
      <template #default="{ item }">
        <SelectOverlay
          :active="selecting"
          :selected="selection.isSelected(item as any)"
          @toggle="selection.toggle(item as any)"
        >
          <CardBaseContent
            v-if="(item as any).original"
            :content="item as any"
            @filters-apply="onFiltersSettingsApply"
            @changed="refresh"
          />
        </SelectOverlay>
      </template>
    </ContentGrid>
    <div v-else>
      <div class="flex justify-center items-center mt-16">
        <h1 class="text-2xl">No posts found.</h1>
      </div>
    </div>

    <SelectionActionBar
      floating
      :selected-count="selection.selectedCount.value"
      :matching-count="itemsTotal"
      :is-selecting-all="isSelectingAll"
      @select-all="selectAll"
      @clear="selection.clear"
    >
      <template #actions>
        <BulkPostActions :posts="selection.selectedRows.value as any" @processed="onProcessed" />
      </template>
    </SelectionActionBar>

    <ListingPaginator
      :first="firstItemIndex"
      :rows="pageSize"
      :total="itemsTotal"
      @page="changePage"
    />
  </div>
</template>
