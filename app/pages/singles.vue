<script setup lang="ts">
import { computed } from 'vue'
import { MostLikedModes } from '~/types/typesFilters'

useHead({ title: 'Singles' })

definePageMeta({
  middleware: ['auth'],
  // Kept alive so back from a /single/ page is instant with the scroll intact —
  // the SPA's version of bfcache. Capped: a cached page keeps its whole grid.
  // useContentListing guards its watchers for this; see the KeepAlive note there.
  keepalive: { max: 10 },
})

const { isMobile } = useWindowSize()
const filtersStore = useFiltersStore()

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
} = useContentListing('allContents')

// Select mode for admins: bulk moderation straight from the listing.
const authStore = useAuthStore()
const { selecting, isSelectingAll, selection, toggleSelecting, selectAll, onProcessed } =
  useBulkSelect(() => items.value as any[], {
    fetchAll: fetchAllMatching as () => Promise<any[]>,
    refresh: () => refresh(),
  })

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
</script>

<template>
  <div>
    <Filterbar @search="onFiltersSettingsApply" @filters-apply="onFiltersSettingsApply" />

    <div class="flex justify-start items-start">
      <NavigationBase class="flex-1" />
      <UButton
        :label="isMobile ? 'Top' : 'Top posts'"
        class="ml-2 nav-pill-outline nav-pill-outline-fuchsia"
        :class="filtersStore.mostLikedMode ? 'nav-pill-outline-active' : ''"
        @click="likedRowToggle"
      >
        <template #leading>
          <UIcon
            name="i-lucide-heart"
            mode="svg"
            :class="filtersStore.mostLikedMode ? 'icon-filled' : ''"
          />
        </template>
      </UButton>
    </div>

    <div v-if="isMostLikedRowVisible">
      <MostLikedRow @filters-apply="onFiltersSettingsApply" />
    </div>

    <div class="mt-4">
      <PageHeader emoji="🖼️" title="Singles" :total="itemsTotal" total-label="posts">
        <template #actions>
          <UButton
            v-if="authStore.isAdmin"
            :icon="selecting ? 'i-lucide-check' : 'i-lucide-square-check'"
            :label="isMobile ? undefined : selecting ? 'Done' : 'Select'"
            color="neutral"
            :variant="selecting ? 'solid' : 'outline'"
            @click="toggleSelecting"
          />
        </template>
      </PageHeader>
      <PageHandoffTitle />

      <div v-if="isLoading === true">
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
              :content="item"
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
