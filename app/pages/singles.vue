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
} = useContentListing('allContents')

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
        :label="isMobile ? 'Top' : 'Top Posts'"
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
      <PageHeader emoji="🖼️" title="Singles" :total="itemsTotal" total-label="contents" />
      <PageHandoffTitle />

      <div v-if="isLoading === true">
        <div class="flex justify-center items-center mt-16">
          <LoadingSpinner />
        </div>
      </div>
      <ContentGrid v-else-if="items.length !== 0" :columns="columns">
        <template #default="{ item }">
          <CardBaseContent
            v-if="(item as any).original"
            :content="item"
            @filters-apply="onFiltersSettingsApply"
            @changed="refresh"
          />
        </template>
      </ContentGrid>
      <div v-else>
        <div class="flex justify-center items-center mt-16">
          <h1 class="text-2xl">No results.</h1>
        </div>
      </div>
    </div>

    <ListingPaginator
      :first="firstItemIndex"
      :rows="pageSize"
      :total="itemsTotal"
      @page="changePage"
    />
  </div>
</template>
