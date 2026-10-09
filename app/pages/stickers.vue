<script setup lang="ts">
import { onMounted, ref } from 'vue'

useHead({ title: 'Stickers' })

definePageMeta({
  middleware: ['auth'],
})

const pb = usePocketBase()
const referenceStore = useReferenceStore()

const items = ref<any[]>([])
const isLoading = ref(true)
const itemsTotal = ref(0)
const currentPage = ref(1)
const perPage = 60

async function fetchStickers(page: number) {
  isLoading.value = true
  try {
    const records = await pb.collection('contents').getList(page, perPage, {
      filter: 'filetype = "sticker"',
      sort: '-created',
      expand: 'idol,group,uploader,uploader.user',
    })
    items.value = records.items
    itemsTotal.value = records.totalItems
  } catch (error) {
    console.error('Error fetching stickers:', error)
  } finally {
    isLoading.value = false
  }
}

async function changePage(e: any) {
  currentPage.value = e.page + 1
  await fetchStickers(currentPage.value)
  window.scrollTo(0, 0)
}

async function onFiltersSettingsApply() {
  currentPage.value = 1
  await fetchStickers(1)
}

onMounted(async () => {
  await referenceStore.ensureLoaded()
  await fetchStickers(1)
})
</script>

<template>
  <div>
    <Filterbar @search="onFiltersSettingsApply" @filters-apply="onFiltersSettingsApply" />

    <div class="flex items-start">
      <NavigationBase class="flex-1" />
    </div>

    <div class="mt-4">
      <PageHeader emoji="😻" title="Stickers" :total="itemsTotal" total-label="stickers" />

      <div v-if="isLoading" class="flex justify-center items-center mt-16">
        <LoadingSpinner />
      </div>

      <div v-else-if="items.length">
        <div class="flex flex-wrap gap-3">
          <CardSticker v-for="sticker in items" :key="sticker.id" :content="sticker" />
        </div>
      </div>

      <div v-else class="flex justify-center items-center mt-16">
        <h1 class="text-2xl">No stickers yet.</h1>
      </div>
    </div>

    <ListingPaginator
      :first="(currentPage - 1) * perPage"
      :rows="perPage"
      :total="itemsTotal"
      @page="changePage"
    />
  </div>
</template>
