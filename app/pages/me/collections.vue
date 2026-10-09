<script setup lang="ts">
useHead({ title: 'My collections' })

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
} = useContentListing('savedCollections')

const isCreateVisible = ref(false)

// A named handler rather than an inline `isCreateVisible = true`: UButton's click
// emit is typed void, and an assignment expression evaluates to the assigned
// value, which trips the typecheck.
function openCreate() {
  isCreateVisible.value = true
}

const { saveCollection, deleteCollection } = useCollectionActions()

async function saveEdit(content: any, changes: { title: string; isPublic: boolean }) {
  await saveCollection(content, changes)
}

async function confirmDelete(_event: Event, content: any) {
  if (await deleteCollection(content)) await fetchItems(itemsCurrentPage.value)
}
</script>

<template>
  <div>
    <Filterbar @search="onFiltersSettingsApply" @filters-apply="onFiltersSettingsApply" />

    <NavigationSaved />

    <div class="mt-4">
      <PageHeader emoji="🗂️" title="My collections" :total="itemsTotal" total-label="collections">
        <template #actions>
          <UButton
            icon="i-lucide-folder-plus"
            label="New collection"
            color="neutral"
            variant="outline"
            size="sm"
            @click="openCreate"
          />
        </template>
      </PageHeader>
      <div v-if="isLoading">
        <div class="flex justify-center items-center mt-16">
          <LoadingSpinner />
        </div>
      </div>

      <ContentGrid v-else-if="items.length" :columns="columns" :gap="8">
        <template #default="{ item }">
          <CardStackedContent
            v-if="(item as any).title"
            :content="item as any"
            :is-set="false"
            show-visibility
            @filters-apply="onFiltersSettingsApply"
          >
            <template #actions>
              <CollectionActionsMenu
                :title="(item as any).title"
                :is-public="(item as any).isPublic"
                @save="saveEdit(item, $event)"
                @delete="confirmDelete($event, item)"
              />
            </template>
          </CardStackedContent>
        </template>
      </ContentGrid>

      <div v-else>
        <div class="flex justify-center items-center mt-16">
          <h1 class="text-2xl">No collections found.</h1>
        </div>
      </div>
    </div>

    <ListingPaginator
      :first="firstItemIndex"
      :rows="pageSize"
      :total="itemsTotal"
      @page="changePage"
    />

    <DialogCreateCollection
      v-if="isCreateVisible"
      :is-visible="isCreateVisible"
      @update:is-visible="isCreateVisible = $event"
      @created="fetchItems(itemsCurrentPage)"
    />
  </div>
</template>
