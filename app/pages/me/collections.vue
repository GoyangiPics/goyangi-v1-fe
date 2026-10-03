<script setup lang="ts">
useHead({ title: 'My Collections' })

definePageMeta({
  middleware: ['auth'],
})

const toast = useToast()
const confirm = useConfirm()
const pb = usePocketBase()

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

async function saveEdit(content: any, { title, isPublic }: { title: string; isPublic: boolean }) {
  try {
    await pb.collection('contents_collections').update(content.id, { title, isPublic })
    content.title = title
    content.isPublic = isPublic
    toast.add({ title: 'Saved!', color: 'success', duration: 2000 })
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to update collection.',
      color: 'error',
      duration: 3000,
    })
  }
}

async function confirmDelete(_event: Event, content: any) {
  if (
    await confirm({
      message: `Delete "${content.title}"?`,
      icon: 'i-lucide-trash-2',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      color: 'error',
    })
  ) {
    try {
      await pb.collection('contents_collections').delete(content.id)
      await fetchItems(itemsCurrentPage.value)
      toast.add({ title: 'Deleted!', color: 'success', duration: 2000 })
    } catch {
      toast.add({
        title: 'Error',
        description: 'Failed to delete collection.',
        color: 'error',
        duration: 3000,
      })
    }
  }
}
</script>

<template>
  <div>
    <Filterbar @search="onFiltersSettingsApply" @filters-apply="onFiltersSettingsApply" />

    <NavigationSaved />

    <div class="mt-4">
      <PageHeader emoji="🗂️" title="My Collections" :total="itemsTotal" total-label="collections">
        <template #actions>
          <UButton
            icon="i-lucide-folder-plus"
            label="New Collection"
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

    <DialogCreateCollection
      v-if="isCreateVisible"
      :is-visible="isCreateVisible"
      @update:is-visible="isCreateVisible = $event"
      @created="fetchItems(itemsCurrentPage)"
    />
  </div>
</template>
