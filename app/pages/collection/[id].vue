<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import { computed } from 'vue'
import { MostLikedModes } from '~/types/typesFilters'

definePageMeta({
  middleware: ['auth'],
  // Kept alive so back from a /single/ page is instant with the scroll intact —
  // the SPA's version of bfcache. Capped: a cached page keeps its whole grid.
  // useContentListing guards its watchers for this; see the KeepAlive note there.
  keepalive: { max: 10 },
})

const route = useRoute()
const pb = usePocketBase()
const filtersStore = useFiltersStore()

const { isMobile } = useWindowSize()

const collectionId = route.params.id as string

const { ogData } = useDetailSeo({
  type: 'collection',
  id: collectionId,
  title: (d) => d?.title || 'Goyangi',
  description: (d) => (d?.username ? `created by ${d.username}` : 'Goyangi'),
  fetchOg: async () => {
    try {
      // See set/[id].vue: the newest item that can carry an embed, not simply
      // the newest, which mid-upload has no renditions yet.
      const [collectionData, first] = await Promise.all([
        pb.collection('contents_collections').getOne(collectionId, { expand: 'user' }),
        firstEmbeddableContent(pb, pb.filter('collections~{:id}', { id: collectionId })),
      ])
      return {
        title: ((collectionData as any).title as string) ?? '',
        username: ((collectionData as any).expand?.user?.[0]?.name as string) ?? '',
        preview: (first?.preview as string) ?? '',
        original: (first?.original as string) ?? '',
        sd: (first?.sd as string) ?? '',
        filetype: (first?.filetype as string) ?? '',
      }
    } catch {
      return { title: '', username: '', preview: '', original: '', sd: '', filetype: '' }
    }
  },
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
} = useContentListing('collectionContents')

// ─── Fullscreen viewer for the whole listing ─────────────────────────────────
// One viewer per page rather than one per card, so prev/next steps across the
// grid — the cards hand their click up with `fullscreen-host`. See
// useListingFullscreen.
const {
  activeContent: fsContent,
  nextContent: fsNextContent,
  activeIndex: fsIndex,
  count: fsCount,
  hasNavigation: fsHasNavigation,
  autoplay: fsAutoplay,
  open: openFullscreen,
  close: closeFullscreen,
  prev: fsPrev,
  next: fsNext,
} = useListingFullscreen(() => items.value as ContentsItem[])
const {
  isLiked: fsLiked,
  isLikeAnimating: fsLikeAnimating,
  likeCount: fsLikeCount,
  handleLike: fsHandleLike,
} = useContentCard(() => fsContent.value)

// Shows the clicked card's title while the collection record is still loading.
const { pageTitle } = usePageTitleHandoff()

const { isLikingAll, likeAllIn } = useLikeAll()

// Opens the same modal a content card does, in its scope-only shape. Picking
// this very collection is a no-op the composable already reports as "already
// there", so it needs no guard of its own.
const isAddToCollectionVisible = ref(false)

function openAddToCollection() {
  isAddToCollectionVisible.value = true
}

/**
 * Likes the whole collection, not just the page — likeAllIn fetches the members
 * itself, which is why it takes an id rather than the rendered items.
 *
 * Refetch afterwards for the reason the set page does: the records likeAllIn
 * fetched are different objects from `items`, so its in-place optimistic updates
 * never reach the cards on screen.
 */
async function likeAll() {
  const result = await likeAllIn({ collectionId })
  if (result) await fetchItems(itemsCurrentPage.value)
}

// Derived from the store, not a local boolean.
//
// `mostLikedMode` is persisted and can be cleared from elsewhere — the logo's
// reset, the filter bar's Reset — so a separate flag drifts out of step with the
// very filter it describes. It started false on every mount while the filter was
// still on, which rendered the button active over a collapsed row and made the
// next click OPEN rather than close.
const isMostLikedRowVisible = computed(() => !!filtersStore.mostLikedMode)

async function likedRowToggle() {
  if (isMostLikedRowVisible.value) filtersStore.reset()
  else filtersStore.setMostLikedMode(MostLikedModes.AllTime)
  await onFiltersSettingsApply()
}
</script>

<template>
  <div>
    <Filterbar @search="onFiltersSettingsApply" @filters-apply="onFiltersSettingsApply" />

    <div>
      <div class="flex justify-start items-center">
        <NavigationBase class="flex-1" />
        <UButton
          :label="isMobile ? 'Top' : 'Top posts'"
          :icon="filtersStore.mostLikedMode ? 'i-lucide-chevrons-up' : 'i-lucide-chevrons-down'"
          color="info"
          class="ml-2"
          @click="likedRowToggle"
        />
      </div>
    </div>

    <div v-if="isMostLikedRowVisible">
      <MostLikedRow @filters-apply="onFiltersSettingsApply" />
    </div>

    <div class="mt-4">
      <PageHeader
        emoji="📚"
        :title="ogData?.title || pageTitle || 'Collection'"
        :total="itemsTotal"
        :total-label="itemsTotal === 1 ? 'post' : 'posts'"
      >
        <template #actions>
          <UButton
            icon="i-lucide-heart"
            :label="isMobile ? undefined : 'Like all'"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="isLikingAll"
            @click="likeAll"
          />
          <UButton
            icon="i-lucide-folders"
            :label="isMobile ? undefined : 'Add all'"
            color="neutral"
            variant="outline"
            size="sm"
            @click="openAddToCollection"
          />
          <DownloadAllButton :items="items" />
        </template>
      </PageHeader>
      <p v-if="ogData?.username" class="text-xs text-night-500 -mt-2 mb-4">
        by <span class="text-night-300">{{ ogData.username }}</span>
      </p>
    </div>

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
          fullscreen-host
          @filters-apply="onFiltersSettingsApply"
          @changed="refresh"
          @open-fullscreen="openFullscreen"
        />
      </template>
    </ContentGrid>
    <div v-else>
      <div class="flex justify-center items-center mt-16">
        <h1 class="text-2xl">No posts found.</h1>
      </div>
    </div>

    <ListingPaginator
      :first="firstItemIndex"
      :rows="pageSize"
      :total="itemsTotal"
      @page="changePage"
    />

    <!-- `live`: the page's own items are among the collection's members, so the
         optimistic membership update lands on the rendered objects rather than
         on the copies the modal fetches. -->
    <QuickCollectionModal
      v-if="isAddToCollectionVisible"
      :is-visible="isAddToCollectionVisible"
      :scope="{ collectionId }"
      :live="items as any"
      scope-label="collection"
      @update:is-visible="isAddToCollectionVisible = $event"
    />

    <!-- The listing's fullscreen viewer — see useListingFullscreen. -->
    <DialogBaseFullscreen
      v-if="fsContent"
      :is-visible="true"
      :content="fsContent"
      :next-content="fsNextContent"
      :autoplay="fsAutoplay"
      :has-navigation="fsHasNavigation"
      :count="fsCount"
      :index="fsIndex"
      :liked="fsLiked"
      :like-animating="fsLikeAnimating"
      :like-count="fsLikeCount"
      @like="fsHandleLike"
      @prev="fsPrev"
      @next="fsNext"
      @update:is-visible="!$event && closeFullscreen()"
    />
  </div>
</template>
