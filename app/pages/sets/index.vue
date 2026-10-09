<script setup lang="ts">
import { computed, ref } from 'vue'

useHead({ title: 'Sets' })

definePageMeta({
  middleware: ['auth'],
})

const authStore = useAuthStore()

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
} = useContentListing('allSets')

const layout = ref<'grid' | 'list'>('grid')

const { copyLinks } = useCopyLinks()

const selection = useRowSelection(() => items.value as any[], {
  keyOf: (set: any) => set.id,
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

// Merge lives on /sets rather than /me/sets because an admin routinely needs to
// merge sets they didn't upload — /me/sets only ever shows their own.
const isMergeVisible = ref(false)

const selectedSets = computed(() =>
  (items.value as any[]).filter((set) => selection.isSelected(set)),
)

const canMerge = computed(() => authStore.isAdmin && selectedSets.value.length >= 2)

function openMerge() {
  isMergeVisible.value = true
}

async function onMerged() {
  selection.clear()
  await fetchItems(itemsCurrentPage.value)
}

// Selection only tracks loaded rows, so clear it rather than let an action run
// against sets nobody can see.
async function onPageChange(e: any) {
  selection.clear()
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
            <CardStackedContent
              v-if="(item as any).title"
              :content="item as any"
              :is-set="true"
              @filters-apply="onFiltersSettingsApply"
              @changed="fetchItems(itemsCurrentPage)"
            />
          </template>
        </ContentGrid>

        <template v-else>
          <SelectionActionBar
            v-if="authStore.isAdmin"
            :selected-count="selection.selectedCount.value"
            @clear="selection.clear"
          >
            <template #actions>
              <UTooltip
                :text="canMerge ? 'Merge selected sets' : 'Select at least two sets'"
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

    <ListingPaginator
      :first="firstItemIndex"
      :rows="pageSize"
      :total="itemsTotal"
      @page="onPageChange"
    />

    <DialogAdminMergeSets
      v-if="isMergeVisible && canMerge"
      :is-visible="isMergeVisible"
      :sets="selectedSets"
      @update:is-visible="isMergeVisible = $event"
      @merged="onMerged"
    />
  </div>
</template>
