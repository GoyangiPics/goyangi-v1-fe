<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import { computed, ref, watch } from 'vue'
import { MostLikedModes } from '~/types/typesFilters'

useHead({ title: 'Home' })

definePageMeta({
  middleware: ['auth'],
  // Kept alive so back from a /single/ page is instant with the scroll intact —
  // the SPA's version of bfcache. Capped: a cached page keeps its whole grid.
  // useContentListing guards its watchers for this; see the KeepAlive note there.
  keepalive: { max: 10 },
})

const filtersStore = useFiltersStore()
const settingsStore = useSettingsStore()

const { isMobile } = useWindowSize()

// Derived from the store, not a local boolean.
//
// `mostLikedMode` lives in the URL (`?top=`) and can be cleared from elsewhere — the logo's
// reset, the filter bar's Reset — so a separate flag drifts out of step with the
// very filter it describes. It started false on every mount while the filter was
// still on, which rendered the button active over a collapsed row and made the
// next click OPEN rather than close.
const isMostLikedRowVisible = computed(() => !!filtersStore.mostLikedMode)

// This page predates useContentListing and used to hand-roll everything the
// composable owns — which is also why it silently lacked the composable's
// rejected-filter toast. The Top Posts row is the one thing still its own.
const {
  isGrouped,
  viewMode,
  restoreStoredViewMode,
  toggleViewMode,
  items,
  itemsTotal,
  isLoading,
  columns,
  firstItemIndex,
  changePage,
  refresh,
  onFiltersSettingsApply,
} = useContentListing('allContents', {
  groupedVariation: 'allSetsUnified',
  viewModeKey: 'homeViewMode',
  // The logo's "start over" — give the view mode back, since clearing a
  // `sort=liked` is exactly what was forcing it. The Top Posts row closes on its
  // own now that it reads the store the reset already cleared.
  // Wrapped, not passed by reference: restoreStoredViewMode is being destructured
  // by this very call, so naming it bare here reads it before it is assigned.
  onQueryCleared: () => restoreStoredViewMode(),
})

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

// ─── New since the last visit ────────────────────────────────────────────────
// The grid is masonry — items are dealt across columns — so there is no single
// place for a "you've seen everything below" divider. Each new card gets a
// badge instead, and the header says how many arrived in total.
const pb = usePocketBase()
const { since: lastVisit, isNew } = useLastVisit()
const newSinceCount = ref(0)

// All contents, not the filtered listing: "what did I miss" is a question about
// the site, and the badges already show which of those are on this page.
watch(lastVisit, async (since) => {
  if (since === null) return
  try {
    const page = await pb.collection('contents').getList(1, 1, {
      // PocketBase's own layout: `created` compares as text, and an ISO `T`
      // sorts after the stored space, which would misplace the same day.
      filter: pb.filter('created > {:since}', {
        since: new Date(since).toISOString().replace('T', ' '),
      }),
      fields: 'id',
      requestKey: 'home-new-since',
    })
    newSinceCount.value = page.totalItems
  } catch {
    // A count is a nicety; the badges still work without it.
  }
})

async function likedRowToggle() {
  if (isMostLikedRowVisible.value) {
    // Closing — hand the mode back to whatever the user actually chose.
    //
    // From storage, NOT from a value captured when the row was opened. That
    // capture was the bug: a persisted `sort=liked` makes honourLikeRanking
    // force ungrouped on load, before the row is ever opened, so what got
    // remembered as "the previous mode" was already the forced one. Closing
    // then restored ungrouped over a stored preference of grouped, and it
    // stuck — every subsequent open re-captured the same forced value.
    filtersStore.reset()
    restoreStoredViewMode()
  } else {
    // Opening — force ungrouped for the per-content ranking. A direct viewMode
    // write is session-only, which is the point: Top Posts must not overwrite
    // the stored preference, and now it doesn't need to read it either.
    viewMode.value = 'ungrouped'
    filtersStore.setMostLikedMode(MostLikedModes.AllTime)
  }
  await onFiltersSettingsApply()
}
</script>

<template>
  <div>
    <Filterbar @search="onFiltersSettingsApply" @filters-apply="onFiltersSettingsApply" />

    <div class="flex justify-start items-start">
      <NavigationBase class="flex-1" />
      <UButton
        :label="isMobile ? 'Top' : 'Top Posts'"
        class="ml-2 nav-pill-outline nav-pill-outline-fuchsia"
        :class="filtersStore.mostLikedMode ? 'nav-pill-outline-active' : ''"
        @click="likedRowToggle"
      >
        <template #leading>
          <UIcon
            name="i-lucide-heart"
            mode="svg"
            :class="filtersStore.mostLikedMode ? 'icon-filled' : ''"
          />
        </template>
      </UButton>
    </div>

    <div v-if="isMostLikedRowVisible">
      <MostLikedRow @filters-apply="onFiltersSettingsApply" />
    </div>

    <div class="mt-4">
      <PageHeader
        emoji="🐱"
        title="Home"
        :total="itemsTotal"
        :total-label="isGrouped ? 'sets' : 'contents'"
      >
        <template #actions>
          <!-- Left of the grouping toggle so that control keeps its position. -->
          <UButton
            icon="i-lucide-star"
            :label="isMobile ? undefined : 'My Feed'"
            color="neutral"
            variant="outline"
            to="/me/feed"
          />
          <!-- layers/rows, not grid/list: this toggles GROUPING (sets vs
               individual contents — two different datasets), and the grid/list
               pair now means layout, on ListingLayoutToggle. Sharing icons made
               two different controls look identical. -->
          <UButton
            :icon="isGrouped ? 'i-lucide-layers' : 'i-lucide-rows-3'"
            :label="isMobile ? undefined : isGrouped ? 'Grouped' : 'Ungrouped'"
            color="neutral"
            variant="outline"
            @click="toggleViewMode"
          />
        </template>
      </PageHeader>

      <p v-if="newSinceCount > 0" class="-mt-2 mb-4 text-xs text-pink-300">
        ✨ {{ newSinceCount.toLocaleString() }} new since your last visit
      </p>

      <PageHandoffTitle />

      <div v-if="isLoading === true">
        <div class="flex justify-center items-center mt-16">
          <LoadingSpinner />
        </div>
      </div>
      <ContentGrid v-else-if="items.length !== 0" :columns="columns">
        <template #default="{ item }">
          <div class="relative">
            <span
              v-if="isNew(item as any)"
              class="absolute -top-1.5 -left-1.5 z-30 px-2 py-0.5 rounded-full bg-pink-500 text-white text-[10px] font-semibold uppercase tracking-wide shadow-md select-none pointer-events-none"
            >
              New
            </span>
            <CardUnified
              v-if="isGrouped"
              :content="item as any"
              @filters-apply="onFiltersSettingsApply"
              @changed="refresh"
            />
            <CardBaseContent
              v-else-if="(item as any).original"
              :content="item"
              fullscreen-host
              @filters-apply="onFiltersSettingsApply"
              @changed="refresh"
              @open-fullscreen="openFullscreen"
            />
          </div>
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
      :rows="+settingsStore.settings.contentCount"
      :total="itemsTotal"
      @page="changePage"
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
