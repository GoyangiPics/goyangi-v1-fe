<script setup lang="ts">
import { ref, watch } from 'vue'

useHead({ title: 'My feed' })

definePageMeta({
  middleware: ['auth'],
  // Kept alive so back from a /single/ page is instant with the scroll intact —
  // the SPA's version of bfcache. Capped: a cached page keeps its whole grid.
  // useContentListing guards its watchers for this; see the KeepAlive note there.
  keepalive: { max: 10 },
})

const route = useRoute()
const filtersStore = useFiltersStore()
const starsStore = useStarsStore()
const { isMobile } = useWindowSize()

const isManageVisible = ref(false)

const {
  items,
  itemsTotal,
  itemsCurrentPage,
  isLoading,
  isGrouped,
  toggleViewMode,
  columns,
  firstItemIndex,
  pageSize,
  fetchItems,
  changePage,
  refresh,
  onFiltersSettingsApply,
} = useContentListing('starredContents', {
  groupedVariation: 'starredSetsUnified',
  // Its own key, not homeViewMode: the two pages are browsed differently and
  // sharing the key would make toggling one silently retarget the other.
  viewModeKey: 'feedViewMode',
  // The baseFilter reads stars at fetch time, so they have to be loaded before
  // the first fetch — hence beforeLoad rather than loading stars on every
  // listing page.
  beforeLoad: async () => {
    await starsStore.ensureLoaded()

    // Stars SCOPE this page; the filter bar narrows within that scope. But
    // `filters` is persisted, so someone who filtered idol=Nayeon on home and
    // then opened here would get (starred) && idol=Nayeon — plausibly empty, and
    // confusingly so.
    //
    // Clear only the two dimensions the star scope owns, and only when the URL
    // doesn't ask for them. Not reset(), which would also wipe searchValue and
    // the legitimate narrowings (tag, uploader, filetype, origin, label, date).
    if (!route.query.idol && !route.query.group) {
      filtersStore.filters.idol = []
      filtersStore.filters.group = []
    }
  },
})

function openManage() {
  isManageVisible.value = true
}

// Stars are only editable in the manager, so one refetch when it closes covers
// every change — a watcher on the star arrays would fire per toggle and race
// this one.
watch(isManageVisible, (open) => {
  if (!open) fetchItems(1)
})
</script>

<template>
  <div>
    <Filterbar @search="onFiltersSettingsApply" @filters-apply="onFiltersSettingsApply" />

    <NavigationSaved />

    <div class="mt-4">
      <PageHeader
        emoji="⭐"
        title="My feed"
        :total="itemsTotal"
        :total-label="isGrouped ? 'sets' : 'posts'"
      >
        <template #actions>
          <!-- No `size`: default, matching /home's header buttons. These sit in
               the same position on a near-identical page, so a smaller pair read
               as a different class of control. -->
          <UButton
            icon="i-lucide-star"
            :label="isMobile ? undefined : 'Manage stars'"
            color="neutral"
            variant="outline"
            @click="openManage"
          />
          <!-- Same control as /home, same icon pairing (layers = grouping, not
               layout — see the note on index.vue). -->
          <UButton
            :icon="isGrouped ? 'i-lucide-layers' : 'i-lucide-rows-3'"
            :label="isMobile ? undefined : isGrouped ? 'Grouped' : 'Ungrouped'"
            color="neutral"
            variant="outline"
            @click="toggleViewMode"
          />
        </template>
      </PageHeader>

      <div v-if="isLoading" class="flex justify-center items-center mt-16">
        <LoadingSpinner />
      </div>

      <!-- A distinct empty state from "no results": nothing starred is a setup
           step, not an empty query, so it gets a CTA rather than a shrug. -->
      <div
        v-else-if="!starsStore.hasAny"
        class="flex flex-col items-center justify-center mt-16 gap-3 text-center"
      >
        <UIcon name="i-lucide-star" class="text-4xl text-night-600" />
        <h1 class="text-2xl">Your feed is empty.</h1>
        <p class="text-sm text-night-400 max-w-sm">
          Star idols and groups to see their posts here.
        </p>
        <UButton icon="i-lucide-star" label="Pick some" size="sm" @click="openManage" />
      </div>

      <ContentGrid v-else-if="items.length" :columns="columns">
        <template #default="{ item }">
          <CardUnified
            v-if="isGrouped"
            :content="item as any"
            @filters-apply="onFiltersSettingsApply"
            @changed="refresh"
          />
          <CardBaseContent
            v-else-if="(item as any).original"
            :content="item as any"
            @filters-apply="onFiltersSettingsApply"
            @changed="refresh"
          />
        </template>
      </ContentGrid>

      <div v-else class="flex justify-center items-center mt-16">
        <h1 class="text-2xl">Nothing found.</h1>
      </div>
    </div>

    <ListingPaginator
      :first="firstItemIndex"
      :rows="pageSize"
      :total="itemsTotal"
      @page="changePage"
    />

    <DialogManageStars
      v-if="isManageVisible"
      :is-visible="isManageVisible"
      @update:is-visible="isManageVisible = $event"
    />
  </div>
</template>
