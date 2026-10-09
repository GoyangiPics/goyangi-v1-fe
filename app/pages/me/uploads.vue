<script setup lang="ts">
import { computed, ref } from 'vue'
useHead({ title: 'My uploads' })

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
  refresh,
  onFiltersSettingsApply,
} = useContentListing('myContents')

const layout = ref<'grid' | 'list'>('grid')

const { copyLinks } = useCopyLinks()

const selection = useRowSelection(() => items.value as any[], {
  keyOf: (content: any) => content.id,
  linksOf: (content: any) => [shortLinks(content)],
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

// Selection is per page; clear it rather than let a copy act on invisible rows.
async function onPageChange(e: any) {
  selection.clear()
  await changePage(e)
}
</script>

<template>
  <div>
    <Filterbar @search="onFiltersSettingsApply" @filters-apply="onFiltersSettingsApply" />

    <NavigationUploads />

    <div class="mt-4">
      <PageHeader emoji="📤" title="My uploads" :total="itemsTotal" total-label="posts">
        <template #actions>
          <ListingLayoutToggle v-model="layout" storage-key="me-uploads" />
        </template>
      </PageHeader>
      <PageHandoffTitle />

      <div v-if="isLoading" class="flex justify-center items-center mt-16">
        <LoadingSpinner />
      </div>

      <template v-else-if="items.length !== 0">
        <ContentGrid v-if="layout === 'grid'" :columns="columns">
          <template #default="{ item }">
            <CardBaseContent
              v-if="(item as any).original"
              :content="item as any"
              hide-uploader
              @filters-apply="onFiltersSettingsApply"
              @changed="refresh"
            >
              <template #actions>
                <ContentActionsMenu
                  :content="item as any"
                  with-trigger
                  @changed="refresh"
                  @content-deleted="refresh"
                  @set-deleted="refresh"
                />
              </template>
            </CardBaseContent>
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
            <ContentListRow
              v-for="item in items"
              :key="(item as any).id"
              :content="item as any"
              :selected="selection.isSelected(item as any)"
              @toggle="selection.toggle(item as any)"
            >
              <template #actions>
                <ContentActionsMenu
                  :content="item as any"
                  with-trigger
                  @changed="refresh"
                  @content-deleted="refresh"
                  @set-deleted="refresh"
                />
              </template>
            </ContentListRow>
          </div>
        </template>
      </template>

      <div v-else class="flex justify-center items-center mt-16">
        <h1 class="text-2xl">No posts found.</h1>
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
