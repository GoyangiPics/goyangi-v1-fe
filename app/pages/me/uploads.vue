<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
  fetchAllMatching,
} = useContentListing('myContents')

const layout = ref<'grid' | 'list'>('grid')

// ─── Failed uploads ──────────────────────────────────────────────────────────
// Counted across all pages, so a failure on page 3 still gets noticed here.
const pb = usePocketBase()
const authStore = useAuthStore()
const { run } = useBulkAction()
const failedIds = ref<string[]>([])

async function loadFailed() {
  if (!authStore.uploader) return
  try {
    const rows = await pb.collection('contents').getFullList({
      filter: pb.filter("uploader = {:up} && preview = '' && encodeError != ''", {
        up: authStore.uploader.id,
      }),
      fields: 'id',
      requestKey: null,
    })
    failedIds.value = rows.map((r) => r.id)
  } catch {
    failedIds.value = []
  }
}

async function retryAllFailed() {
  await run({
    items: failedIds.value,
    action: (id) => pb.send(`/api/contents/${id}/reprocess`, { method: 'POST', requestKey: null }),
    progress: 'Retrying…',
    success: (n) => `Retrying ${n} post${n === 1 ? '' : 's'}`,
    failure: "Couldn't retry",
  })
  await Promise.all([loadFailed(), refresh()])
}

onMounted(loadFailed)

const { copyLinks } = useCopyLinks()

// One selection for both layouts: list rows always show their checkboxes, the
// grid shows them in select mode. It spans pages, so "Select all" covers every
// post the filters match.
const { selecting, isSelectingAll, selection, toggleSelecting, selectAll, onProcessed } =
  useBulkSelect(() => items.value as any[], {
    links: (content: any) => [shortLinks(content)],
    fetchAll: fetchAllMatching as () => Promise<any[]>,
    refresh: () => Promise.all([refresh(), loadFailed()]),
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

    <NavigationUploads />

    <div class="mt-4">
      <PageHeader emoji="📤" title="My uploads" :total="itemsTotal" total-label="posts">
        <template #actions>
          <UButton
            v-if="layout === 'grid'"
            :icon="selecting ? 'i-lucide-check' : 'i-lucide-square-check'"
            :label="selecting ? 'Done' : 'Select'"
            color="neutral"
            :variant="selecting ? 'solid' : 'outline'"
            @click="toggleSelecting"
          />
          <ListingLayoutToggle v-model="layout" storage-key="me-uploads" />
        </template>
      </PageHeader>
      <PageHandoffTitle />

      <UAlert
        v-if="failedIds.length"
        color="error"
        variant="soft"
        icon="i-lucide-circle-x"
        class="mb-4"
        :title="`${failedIds.length} post${failedIds.length === 1 ? '' : 's'} couldn't be processed`"
        description="Retrying usually fixes it. If not, delete them and upload again."
        :actions="[
          {
            label: 'Retry all',
            icon: 'i-lucide-refresh-cw',
            color: 'error',
            variant: 'solid',
            onClick: retryAllFailed,
          },
        ]"
      />

      <div v-if="isLoading" class="flex justify-center items-center mt-16">
        <LoadingSpinner />
      </div>

      <template v-else-if="items.length !== 0">
        <ContentGrid v-if="layout === 'grid'" :columns="columns">
          <template #default="{ item }">
            <SelectOverlay
              :active="selecting"
              :selected="selection.isSelected(item as any)"
              @toggle="selection.toggle(item as any)"
            >
              <!-- Processing or failed: a stand-in card with Retry and Delete, rather
                   than skipping the post while still counting it. -->
              <CardPendingContent
                v-if="!(item as any).preview"
                :content="item as any"
                @changed="refresh"
              />
              <CardBaseContent
                v-else-if="(item as any).original"
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
      @page="onPageChange"
    />
  </div>
</template>
