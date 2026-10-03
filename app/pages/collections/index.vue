<script setup lang="ts">
useHead({ title: 'Collections' })

definePageMeta({
  middleware: ['auth'],
})

const {
  items,
  itemsTotal,
  isLoading,
  columns,
  firstItemIndex,
  pageSize,
  changePage,
  onFiltersSettingsApply,
} = useContentListing('allCollections')
</script>

<template>
  <div>
    <Filterbar @search="onFiltersSettingsApply" @filters-apply="onFiltersSettingsApply" />

    <NavigationBase />

    <div class="mt-4">
      <PageHeader emoji="📚" title="Collections" :total="itemsTotal" total-label="collections" />
      <div v-if="isLoading === true">
        <div class="flex justify-center items-center mt-16">
          <LoadingSpinner />
        </div>
      </div>
      <ContentGrid v-else-if="items.length !== 0" :columns="columns" :gap="8">
        <template #default="{ item }">
          <CardStackedContent
            v-if="(item as any).title"
            :content="item as any"
            :is-set="false"
            @filters-apply="onFiltersSettingsApply"
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
