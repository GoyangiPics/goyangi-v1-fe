<script setup lang="ts">
import { computed, ref } from 'vue'

useHead({ title: 'My Sets' })

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
} = useContentListing('mySets')

const layout = ref<'grid' | 'list'>('grid')

const { copyLinks } = useCopyLinks()

const selection = useRowSelection(() => items.value as any[], {
  keyOf: (set: any) => set.id,
  // A set row contributes one link-triple per clip, which is what makes
  // "select three sets, copy every preview link" work in one action.
  linksOf: (set: any) =>
    ((set.expand?.contents_via_set ?? []) as any[]).map((clip) => shortLinks(clip)),
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

// Selection is per page — useRowSelection tracks the rows currently loaded — so
// clear it on navigation rather than letting a copy act on rows nobody can see.
async function onPageChange(e: any) {
  selection.clear()
  await changePage(e)
}
</script>

<template>
  <div>
    <Filterbar @search="onFiltersSettingsApply" @filters-apply="onFiltersSettingsApply" />

    <NavigationUploads class="mt-6" />

    <div class="mt-4">
      <PageHeader emoji="🎞️" title="My Sets" :total="itemsTotal" total-label="sets">
        <template #actions>
          <ListingLayoutToggle v-model="layout" storage-key="me-sets" />
        </template>
      </PageHeader>

      <div v-if="isLoading">
        <div class="flex justify-center items-center mt-16">
          <LoadingSpinner />
        </div>
      </div>

      <template v-else-if="items.length">
        <!-- Grid -->
        <ContentGrid v-if="layout === 'grid'" :columns="columns" :gap="8">
          <template #default="{ item }">
            <CardStackedContent
              :content="item as any"
              :is-set="true"
              @filters-apply="onFiltersSettingsApply"
              @changed="fetchItems(itemsCurrentPage)"
            />
          </template>
        </ContentGrid>

        <!-- List -->
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
        <div class="flex flex-col items-center justify-center mt-16 gap-3">
          <h1 class="text-2xl">No sets yet.</h1>
          <UButton to="/uploads" icon="i-lucide-cloud-upload" label="Upload something" size="sm" />
        </div>
      </div>
    </div>

    <ListingPaginator
      :first="firstItemIndex"
      :rows="pageSize"
      :total="itemsTotal"
      @page="onPageChange"
    />
  </div>
</template>
