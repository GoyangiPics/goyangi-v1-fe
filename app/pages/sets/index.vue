<script setup lang="ts">
import { computed, ref } from 'vue'

useHead({ title: 'Sets' })

definePageMeta({
  middleware: ['auth'],
})

const {
  items,
  itemsTotal,
  itemsCurrentPage,
  isLoading,
  columns,
  firstItemIndex,
  pageSize,
  fetchItems,
  changePage,
  onFiltersSettingsApply,
  fetchAllMatching,
} = useContentListing('allSets')

const { isMobile } = useWindowSize()

const layout = ref<'grid' | 'list'>('grid')

const { copyLinks } = useCopyLinks()

// One selection for both layouts, spanning pages — see useBulkSelect. Bulk
// actions (BulkSetActions) offer download to everyone, and merge and delete
// to admins and to owners of every set involved.
const { selecting, isSelectingAll, selection, toggleSelecting, selectAll, onProcessed } =
  useBulkSelect(() => items.value as any[], {
    links: (set: any) =>
      ((set.expand?.contents_via_set ?? []) as any[]).map((clip) => shortLinks(clip)),
    fetchAll: fetchAllMatching as () => Promise<any[]>,
    refresh: () => fetchItems(itemsCurrentPage.value),
  })

const copyMap = computed(() => ({
  preview: { urls: selection.previewUrls.value, label: 'Preview' },
  sd: { urls: selection.sdUrls.value, label: 'SD' },
  hd: { urls: selection.hdUrls.value, label: 'HD' },
}))

function onCopy(kind: 'preview' | 'sd' | 'hd') {
  const { urls, label } = copyMap.value[kind]
  copyLinks(urls, label)
}

async function onPageChange(e: any) {
  await changePage(e)
}
</script>

<template>
  <div>
    <Filterbar @search="onFiltersSettingsApply" @filters-apply="onFiltersSettingsApply" />

    <NavigationBase />

    <div class="mt-4">
      <PageHeader emoji="🎞️" title="Sets" :total="itemsTotal" total-label="sets">
        <template #actions>
          <UButton
            v-if="layout === 'grid'"
            :icon="selecting ? 'i-lucide-check' : 'i-lucide-square-check'"
            :label="isMobile ? undefined : selecting ? 'Done' : 'Select'"
            color="neutral"
            :variant="selecting ? 'solid' : 'outline'"
            @click="toggleSelecting"
          />
          <ListingLayoutToggle v-model="layout" storage-key="sets" />
        </template>
      </PageHeader>

      <div v-if="isLoading === true">
        <div class="flex justify-center items-center mt-16">
          <LoadingSpinner />
        </div>
      </div>

      <template v-else-if="items.length !== 0">
        <ContentGrid v-if="layout === 'grid'" :columns="columns" :gap="8">
          <template #default="{ item }">
            <SelectOverlay
              :active="selecting"
              :selected="selection.isSelected(item as any)"
              @toggle="selection.toggle(item as any)"
            >
              <CardStackedContent
                v-if="(item as any).title"
                :content="item as any"
                :is-set="true"
                @filters-apply="onFiltersSettingsApply"
                @changed="fetchItems(itemsCurrentPage)"
              />
            </SelectOverlay>
          </template>
        </ContentGrid>

        <template v-else>
          <CopyLinksBar
            :preview-count="selection.previewUrls.value.length"
            :sd-count="selection.sdUrls.value.length"
            :hd-count="selection.hdUrls.value.length"
            :selectable-count="selection.selectableCount.value"
            :selected-count="selection.selectedCount.value"
            :all-selected="selection.allSelected.value"
            :some-selected="selection.someSelected.value"
            @update:all-selected="selection.allSelected.value = $event"
            @copy="onCopy"
            @clear="selection.clear"
          />

          <div class="flex flex-col gap-1.5">
            <SetListRow
              v-for="set in items"
              :key="(set as any).id"
              :set="set as any"
              :selected="selection.isSelected(set as any)"
              @toggle="selection.toggle(set as any)"
            >
              <template #actions>
                <SetActionsMenu
                  :content="set as any"
                  :is-set="true"
                  with-trigger
                  @saved="fetchItems(itemsCurrentPage)"
                  @deleted="fetchItems(itemsCurrentPage)"
                />
              </template>
            </SetListRow>
          </div>
        </template>
      </template>

      <div v-else>
        <div class="flex justify-center items-center mt-16">
          <h1 class="text-2xl">No sets found.</h1>
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
        <BulkSetActions :sets="selection.selectedRows.value as any" @processed="onProcessed" />
      </template>
    </SelectionActionBar>

    <ListingPaginator
      :first="firstItemIndex"
      :rows="pageSize"
      :total="itemsTotal"
      @page="onPageChange"
    />
  </div>
</template>
