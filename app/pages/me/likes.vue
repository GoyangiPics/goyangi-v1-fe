<script setup lang="ts">
useHead({ title: 'My likes' })

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
  refresh,
  onFiltersSettingsApply,
} = useContentListing('likedContents')
</script>

<template>
  <div>
    <Filterbar @search="onFiltersSettingsApply" @filters-apply="onFiltersSettingsApply" />

    <NavigationSaved />

    <div class="mt-4">
      <PageHeader emoji="🔖" title="Saved" :total="itemsTotal" total-label="posts" />
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
            :content="item as any"
            @filters-apply="onFiltersSettingsApply"
            @changed="refresh"
          />
        </template>
      </ContentGrid>
      <div v-else>
        <div class="flex justify-center items-center mt-16">
          <h1 class="text-2xl">No posts found.</h1>
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
