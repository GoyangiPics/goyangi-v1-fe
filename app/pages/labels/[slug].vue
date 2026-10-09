<script setup lang="ts">
import { computed } from 'vue'

// Public, like the label index — see the note there.

const route = useRoute()

const slug = computed(() => String(route.params.slug))

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
} = useContentListing('labelContents')

useSeoMeta({
  title: () => `${slug.value} — Labels — Goyangi`,
  description: () => `Posts labelled "${slug.value}" on Goyangi.`,
})

// The home feed filtered by this label. A link, because the URL is the filter
// state: `?label=<slug>` is the whole action, and it can open in a new tab.
const homeFilteredByLabel = computed(() => ({ path: '/', query: { label: slug.value } }))
</script>

<template>
  <div>
    <Filterbar @search="onFiltersSettingsApply" @filters-apply="onFiltersSettingsApply" />

    <NavigationBase class="my-4" />

    <PageHeader
      emoji="🏷️"
      :title="slug"
      :total="itemsTotal"
      :total-label="itemsTotal === 1 ? 'post' : 'posts'"
    >
      <template #actions>
        <UButton
          icon="i-lucide-filter"
          label="Filter home"
          color="neutral"
          variant="outline"
          size="sm"
          :to="homeFilteredByLabel"
        />
        <UButton
          icon="i-lucide-tag"
          label="All labels"
          color="neutral"
          variant="outline"
          size="sm"
          to="/labels"
        />
      </template>
    </PageHeader>

    <div v-if="isLoading" class="flex justify-center items-center mt-16">
      <LoadingSpinner />
    </div>

    <ContentGrid v-else-if="items.length" :columns="columns">
      <template #default="{ item }">
        <CardBaseContent
          v-if="(item as any).original"
          :content="item as any"
          @filters-apply="onFiltersSettingsApply"
          @changed="refresh"
        />
      </template>
    </ContentGrid>

    <div v-else class="flex flex-col items-center justify-center mt-16 gap-2">
      <h1 class="text-2xl text-night-400">No posts labelled "{{ slug }}".</h1>
      <UButton to="/labels" label="Browse all labels" size="sm" color="neutral" variant="outline" />
    </div>

    <ListingPaginator
      :first="firstItemIndex"
      :rows="pageSize"
      :total="itemsTotal"
      @page="changePage"
    />
  </div>
</template>
