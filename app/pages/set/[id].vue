<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import { computed, onMounted, ref } from 'vue'

// TEMPORARILY PUBLIC: a shared set link opens without an account, same as
// /single/[id]. The auth-only actions here (like, like all, add to collection,
// report, save a filter) prompt for login instead — see useAuthGate().
// Restore by adding middleware: ['auth'] to the definePageMeta call below.

// authStore / requireAuth used to be needed by the inline likeAll; useLikeAll
// owns the auth gate now.
const route = useRoute()

// Kept alive so back from a /single/ page is instant with the scroll intact —
// the SPA's version of bfcache. Capped: a cached page keeps its whole grid.
// useContentListing guards its watchers for this; see the KeepAlive note there.
definePageMeta({ keepalive: { max: 10 } })
const pb = usePocketBase()

const { isMobile } = useWindowSize()
const { canShare, sharePage } = useShare()

const setId = route.params.id as string

const { ogData } = useDetailSeo({
  type: 'set',
  id: setId,
  title: (d) => d?.title || 'Goyangi',
  description: (d) => (d?.uploader ? `created by ${d.uploader}` : 'Goyangi'),
  fetchOg: async () => {
    try {
      // The newest item that can actually carry an embed, not simply the
      // newest — mid-upload those are the same record, and it has no renditions
      // yet, so the link unfurled to nothing. See firstEmbeddableContent.
      const [setData, first] = await Promise.all([
        pb.collection('contents_sets').getOne(setId, { expand: 'uploader' }),
        firstEmbeddableContent(pb, pb.filter('set={:id}', { id: setId })),
      ])
      return {
        title: ((setData as any).title as string) ?? '',
        uploader: ((setData as any).expand?.uploader?.[0]?.name as string) ?? '',
        preview: (first?.preview as string) ?? '',
        original: (first?.original as string) ?? '',
        sd: (first?.sd as string) ?? '',
        filetype: (first?.filetype as string) ?? '',
        source: (first?.source as string) ?? '',
      }
    } catch {
      return {
        title: '',
        uploader: '',
        preview: '',
        original: '',
        sd: '',
        filetype: '',
        source: '',
      }
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
} = useContentListing('setContents')

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

// Shows the clicked card's title while the set record is still loading.
const { pageTitle } = usePageTitleHandoff()
const { isLikingAll, likeAllIn } = useLikeAll()

// The bulk add asks which collection first, so it opens the same modal a content
// card does — in its scope-only shape, with "add all contents" locked on.
const isAddToCollectionVisible = ref(false)

function openAddToCollection() {
  isAddToCollectionVisible.value = true
}

// onMounted, so the server render of this SSR'd route never counts a crawler.
const { views, register: registerView } = useViewCounter('set', setId)

// The page previously only had ogData (a flattened projection for SEO); the edit
// dialog needs the record itself, with idols/uploaders expanded.
const authStore = useAuthStore()
const setRecord = ref<any>(null)
const isEditVisible = ref(false)

async function loadSetRecord() {
  try {
    setRecord.value = await pb
      .collection('contents_sets')
      .getOne(setId, { expand: 'idol,group,uploader,uploader.user', requestKey: null })
  } catch {
    setRecord.value = null
  }
}

/** Mirrors contents_sets.deleteRule; the rules are the real gate. */
const canEditSet = computed(() => {
  if (!authStore.canUpload) return false
  if (authStore.isAdmin) return true
  const uploaders = (setRecord.value?.expand?.uploader ?? []) as any[]
  const userId = authStore.user?.id
  return (
    !!userId && uploaders.some((u: any) => u?.user === userId || u?.expand?.user?.id === userId)
  )
})

function openEdit() {
  isEditVisible.value = true
}

async function onSetSaved() {
  await loadSetRecord()
  await fetchItems(itemsCurrentPage.value)
}

onMounted(() => {
  registerView()
  loadSetRecord()
})

// NOTE: this used to like only the items on the current page. likeAllIn covers
// the whole set, which is what the button says and what `setContents` scopes to
// anyway (it applies no user filters) — but it is a behaviour change.
async function likeAll() {
  const result = await likeAllIn({ setId })
  // The fetched records are different objects from `items`, so the in-place
  // optimistic updates inside likeAllIn don't reach this page's list.
  if (result) await fetchItems(itemsCurrentPage.value)
}
</script>

<template>
  <div>
    <Filterbar @search="onFiltersSettingsApply" @filters-apply="onFiltersSettingsApply" />

    <div>
      <div class="flex justify-start items-center">
        <NavigationBase class="flex-1" />
      </div>
    </div>

    <div class="mt-4">
      <PageHeader
        emoji="🎞️"
        :title="ogData?.title || pageTitle || 'Set'"
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
          <UButton
            v-if="canShare"
            icon="i-lucide-share"
            :label="isMobile ? undefined : 'Share'"
            color="neutral"
            variant="outline"
            size="sm"
            @click="sharePage(ogData?.title || pageTitle)"
          />
          <UButton
            v-if="canEditSet"
            icon="i-lucide-pencil"
            :label="isMobile ? undefined : 'Edit'"
            color="neutral"
            variant="outline"
            size="sm"
            @click="openEdit"
          />
          <UButton
            v-if="ogData?.source?.trim()"
            icon="i-lucide-link"
            :label="isMobile ? undefined : 'Source'"
            color="neutral"
            variant="outline"
            size="sm"
            :to="ogData!.source"
            target="_blank"
          />
        </template>
      </PageHeader>
      <div class="flex items-center gap-2 -mt-2 mb-4">
        <p v-if="ogData?.uploader" class="text-xs text-night-500">
          by <span class="text-night-300">{{ ogData.uploader }}</span>
        </p>
        <ViewCountBadge :views="views" />
      </div>
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
          hide-set
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

    <!-- `live`: the page's own items are among the set's, so the optimistic
         membership update lands on the rendered objects rather than on the
         copies the modal fetches. -->
    <QuickCollectionModal
      v-if="isAddToCollectionVisible"
      :is-visible="isAddToCollectionVisible"
      :scope="{ setId }"
      :live="items as any"
      @update:is-visible="isAddToCollectionVisible = $event"
    />

    <DialogSetEdit
      v-if="isEditVisible && setRecord"
      :is-visible="isEditVisible"
      :set="setRecord"
      @update:is-visible="isEditVisible = $event"
      @saved="onSetSaved"
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
