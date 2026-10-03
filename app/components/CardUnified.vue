<script setup lang="ts">
import type { ContentsItem, SetsUnifiedItem } from '~/types/appTypes'
import { useSwipe } from '@vueuse/core'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'

const props = defineProps<{
  content: SetsUnifiedItem
  hideUploader?: boolean
}>()

const emit = defineEmits(['filtersApply', 'changed'])

const filtersStore = useFiltersStore()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const { activeKey } = useKeyboardShortcuts()
const { requireAuth } = useAuthGate()
const { filtersApply } = useFilterApply(() => emit('filtersApply'))
const { titleTagRef, titleOverflows, checkTitleOverflow } = useTitleOverflow()

const showExtras = computed(() => settingsStore.settings.noDistractionMode === 'Disabled')

// ─── Carousel: the set's contents, filtered by the active filters ───────────

// True when no filter is set, or any selected filter item matches by id.
function hasMatchById(filterArr: any[], expandArr: any[] | undefined) {
  if (!filterArr || filterArr.length === 0) return true
  if (!expandArr || expandArr.length === 0) return false
  const ids = new Set(expandArr.map((e: any) => e.id))
  return filterArr.some((item: any) => ids.has(item.id))
}

function contentMatchesFilters(c: ContentsItem): boolean {
  const f = filtersStore.filters
  const ex = (c.expand as any) ?? {}

  if (!hasMatchById(f.idol, ex.idol)) return false
  if (!hasMatchById(f.group, ex.group)) return false
  if (!hasMatchById(f.tag, ex.tag)) return false
  if (f.uploader && f.uploader.length > 0) {
    const uploaderId = ex.uploader?.id
    if (!uploaderId || !f.uploader.some((u: any) => u.id === uploaderId)) return false
  }
  if (f.filetype && f.filetype.length > 0) {
    if (!f.filetype.some((ft: any) => ft.value === c.filetype)) return false
  }
  return true
}

const filteredContents = computed<ContentsItem[]>(() => {
  const list = ((props.content.expand as any)?.contents_via_set ?? []) as ContentsItem[]
  // Filter reactivity is tracked through contentMatchesFilters, which reads
  // filtersStore.filters inside this computed. (An empty list tracks nothing,
  // but its result is [] whatever the filters say, so nothing is missed.)
  return list.filter(contentMatchesFilters)
})

function byLikesThenOldest(a: ContentsItem, b: ContentsItem) {
  const aLikes = (a.expand as any)?.likes?.length ?? 0
  const bLikes = (b.expand as any)?.likes?.length ?? 0
  if (bLikes !== aLikes) return bLikes - aLikes
  return new Date(a.created).getTime() - new Date(b.created).getTime()
}

/*
 * The carousel order, deliberately NOT a computed over live like counts.
 *
 * Liking mutates `expand.likes` in place, so a sort keyed on the live count
 * re-ranks the list under the viewer: the item you just liked jumps to the
 * front, the "3/12" badge snaps to "1/12", and prev/next carry on through a
 * different order mid-browse.
 *
 * Instead the ranking is frozen as `orderedIds` and only recomputed when the
 * *set of items* changes (a filter change, or fresh data with different
 * contents). Every run still re-maps through the freshest objects, so a
 * refetch that returns the same ids swaps in the new records without
 * disturbing the order on screen.
 */
const orderedIds = shallowRef<string[]>([])
const sortedContents = shallowRef<ContentsItem[]>([])

watch(
  filteredContents,
  (list) => {
    const ids = new Set(list.map((c) => c.id))
    const sameItems =
      ids.size === orderedIds.value.length && orderedIds.value.every((id) => ids.has(id))

    if (!sameItems) orderedIds.value = list.toSorted(byLikesThenOldest).map((c) => c.id)

    const byId = new Map(list.map((c) => [c.id, c]))
    sortedContents.value = orderedIds.value
      .map((id) => byId.get(id))
      .filter((c): c is ContentsItem => !!c)
  },
  { immediate: true },
)

// Track the active item by id, not index — the index a given item sits at can
// still shift when filters change or fresh data lands, and a positional index
// would then silently point at a different item.
const activeId = ref<string | null>(null)
const activeIndex = computed(() => {
  const idx = sortedContents.value.findIndex((c) => c.id === activeId.value)
  return idx === -1 ? 0 : idx
})
const activeContent = computed<ContentsItem | null>(
  () => sortedContents.value[activeIndex.value] ?? null,
)
const contentCount = computed(() => sortedContents.value.length)
const hasMultiple = computed(() => contentCount.value > 1)

/** The item one step forward, wrapping like stepContent — for the viewer's prefetch. */
const nextInSet = computed<ContentsItem | null>(() =>
  hasMultiple.value
    ? (sortedContents.value[(activeIndex.value + 1) % contentCount.value] ?? null)
    : null,
)

function stepContent(step: number) {
  if (!hasMultiple.value) return
  const idx = (activeIndex.value + step + contentCount.value) % contentCount.value
  activeId.value = sortedContents.value[idx]?.id ?? null
  hasStepped.value = true
}

// ─── Mounted window ──────────────────────────────────────────────────────────
//
// Which items of the set have a media element in the DOM. One, until the person
// steps; after that the items visited most recently plus the one ahead, the
// inactive ones hidden (v-show) and paused.
//
// A media element is the buffer, so remounting one — which is what a keyed swap
// did — starts its fetch over, 206 by 206, even for a clip that was playing a
// second ago. Keeping visited items mounted means stepping back to any of them
// costs nothing, not just the one immediately behind (the first cut kept only
// the neighbours, and stepping back three re-created the element). The one
// ahead is the prefetch: it loads while nobody is looking at it.
//
// Gated on the first step, deliberately. The grouped home page shows about
// twenty set cards; mounting neighbours for all of them would fetch forty clips
// nobody asked for — the same waste the preload="auto" removal fixed. One step
// is the signal that this card is being browsed, and only then is it worth it.

const hasStepped = ref(false)
// Declared here rather than with the other dialogs below because the window
// watches it: the card must not load while its viewer is open.
const isFullscreenModalVisible = ref(false)

/**
 * How many visited items stay mounted per card. Paused hidden videos are cheap,
 * not free. Ten, so a set of that size — the common size — can be looped without
 * evicting and remounting anything.
 */
const MAX_MOUNTED_VISITED = 10

/** Ids visited, most recent last. Trimmed to MAX_MOUNTED_VISITED. */
const visitedIds = shallowRef<string[]>([])

// Not while the fullscreen viewer is open. The viewer steps this card's
// activeContent in lockstep, and the card used to follow: mounting and
// prefetching the SD file of every item the viewer showed in HD, under an
// overlay nobody could see through — two files per step, one of them wasted.
// Visits made in the viewer are the viewer's; the card records where it is
// again when the viewer closes.
watch(
  [activeContent, isFullscreenModalVisible],
  ([current, viewerOpen]) => {
    if (!current || viewerOpen) return
    const next = visitedIds.value.filter((id) => id !== current.id)
    next.push(current.id)
    visitedIds.value = next.slice(-MAX_MOUNTED_VISITED)
  },
  { immediate: true },
)

/** The window as it stood when the viewer opened; held until it closes. */
const frozenWindow = shallowRef<ContentsItem[] | null>(null)

const liveWindow = computed<ContentsItem[]>(() => {
  const list = sortedContents.value
  const n = list.length
  const active = activeIndex.value
  if (!hasStepped.value || n <= 1) return list[active] ? [list[active]] : []
  const want = new Set(visitedIds.value)
  want.add(list[active]!.id)
  want.add(list[(active + 1) % n]!.id)
  // In set order, not step order, so the DOM doesn't reorder on every step.
  return list.filter((c) => want.has(c.id))
})

watch(isFullscreenModalVisible, (open) => {
  frozenWindow.value = open ? liveWindow.value : null
})

const mountedContents = computed<ContentsItem[]>(() => frozenWindow.value ?? liveWindow.value)

function prevContent() {
  stepContent(-1)
}

function nextContent() {
  stepContent(1)
}

// Single-item sets link straight to the content; real sets to the set page.
//
// setHref reads the set's own child count rather than `contentCount`, which is
// the FILTERED count — a five-item set narrowed to one by the active filters is
// still a set, and linking it to /single/ made the destination depend on the
// filter bar.
const titleHref = computed(() => setHref(props.content))

// ─── Like / copy / download on the active item ───────────────────────────────

const { isLiked, likeContent, isLikeAnimating, likeCount, handleLike, copyAvif, download } =
  useContentCard(() => activeContent.value)

// sortedContents is the whole set with `likes` already expanded (see
// UNIFIED_SET_EXPAND), so this costs no extra requests and updates in place.
const { likeAllItems } = useLikeAll()

function likeAllInSet() {
  likeAllItems(sortedContents.value)
}

// ─── Media readiness ─────────────────────────────────────────────────────────
// The whole card stays skeletoned until the first media load; carousel swaps
// only reset the per-item readiness used for the overflow rechecks.

const initialLoaded = ref(false)
const mediaReady = ref(false)

// Items whose media element has loaded (or failed — either way, it has a
// height). With neighbours mounted, stepping onto one of them fires no `loaded`
// event: it loaded while hidden, and nothing about it changes on the step. So
// readiness is looked up here rather than awaited.
const loadedIds = shallowRef<Set<string>>(new Set())

function markLoaded(id: string) {
  if (loadedIds.value.has(id)) return
  const next = new Set(loadedIds.value)
  next.add(id)
  loadedIds.value = next
}

const mediaAreaRef = ref<HTMLElement | null>(null)

// Carousel swaps remount the media element (keyed by content id), which has
// no intrinsic height until the new file loads — without a lock the card
// collapses and the whole masonry column jumps. Freeze the media area at its
// current height during the swap and release once the new media settles.
const mediaMinHeight = ref<number | null>(null)

/**
 * Hold every item in the set at the shape of its tallest, so stepping through a
 * mixed-ratio set doesn't resize the card at all.
 *
 * The height lock above only bridges the swap — it releases the moment the new
 * media loads, and the card then snaps to the new item's height. This removes the
 * snap by never changing the box in the first place.
 *
 * Null unless every item has stored dimensions (a floor computed from a subset
 * would be too short for whatever it couldn't see), and skipped when the uniform
 * setting is on, which already pins the shape globally.
 */
const setAspectRatio = computed(() => {
  if (settingsStore.settings.uniformCardRatio !== 'Disabled') return null
  if (!hasMultiple.value) return null
  return tallestAspectRatio(sortedContents.value)
})

// Both take the item's id: a hidden neighbour loading is not the active item
// becoming ready, and must not release the active item's height lock.
function onMediaLoaded(id: string) {
  markLoaded(id)
  if (id !== activeContent.value?.id) return
  initialLoaded.value = true
  mediaReady.value = true
}

function onMediaError(id: string) {
  // Failed media never fires `load` — release the height lock and reveal the
  // card so it doesn't stay a pulsing skeleton forever (the media area shows
  // the broken state, but title/actions stay usable).
  markLoaded(id)
  if (id !== activeContent.value?.id) return
  mediaMinHeight.value = null
  initialLoaded.value = true
  mediaReady.value = true
}

watch(activeContent, (next) => {
  // A neighbour that finished loading while hidden is ready the moment it is
  // shown; there is no swap to bridge and no event coming.
  if (next && loadedIds.value.has(next.id)) {
    mediaReady.value = true
    return
  }
  // Pre-flush: the DOM still shows the outgoing media, so this measures the
  // height we want to preserve.
  if (initialLoaded.value && mediaAreaRef.value)
    mediaMinHeight.value = mediaAreaRef.value.offsetHeight
  mediaReady.value = false
})

watch(
  () => props.content.title,
  () => nextTick(checkTitleOverflow),
)
watch(mediaReady, (v) => {
  if (v) {
    mediaMinHeight.value = null
    nextTick(checkTitleOverflow)
  }
})

// ─── Dialogs + context menu + gestures ───────────────────────────────────────

const isAddToCollectionVisible = ref(false)
const isLabelsVisible = ref(false)
const isReportVisible = ref(false)
const autoplayInFullscreen = ref(false)

// Both write to PocketBase as the current user — anonymous visitors get the
// login prompt instead of an empty modal.
function openAddToCollection() {
  if (!requireAuth('add content to a collection')) return
  isAddToCollectionVisible.value = true
}

function openLabels() {
  if (!requireAuth('add labels')) return
  isLabelsVisible.value = true
}

function openReport() {
  if (!requireAuth('report content')) return
  isReportVisible.value = true
}

function openFullscreenWithAutoplay() {
  autoplayInFullscreen.value = true
  isFullscreenModalVisible.value = true
}

watch(isFullscreenModalVisible, (v) => {
  if (!v) autoplayInFullscreen.value = false
})

const {
  menuRef: contentActionsMenuRef,
  adminMenuRef,
  onContextMenu: handleContextMenu,
} = useContextMenuTrigger(mediaAreaRef)

useSwipe(mediaAreaRef, {
  onSwipeEnd: (_, direction) => {
    if (direction === 'left') nextContent()
    else if (direction === 'right') prevContent()
  },
})

// ←/→ step the set under the cursor, matching the hover-revealed arrows and the
// swipe above, so the carousel can be walked without opening it fullscreen.
//
// Gated on this card's own dialogs. The fullscreen viewer binds ←/→ itself, and
// opening it over a hovered card does not necessarily fire mouseleave — so
// without this, one keypress would step the dialog AND the card behind it, and
// closing the dialog would land somewhere two items along.
useHoverArrowKeys(mediaAreaRef, {
  onPrev: prevContent,
  onNext: nextContent,
  isEnabled: () =>
    hasMultiple.value &&
    !isFullscreenModalVisible.value &&
    !isAddToCollectionVisible.value &&
    !isLabelsVisible.value &&
    !isReportVisible.value,
})

// Keyboard "quick action" modifiers: holding a key while clicking the media
// triggers the action instead of opening fullscreen.
function handleMediaClick() {
  switch (activeKey.value) {
    case 'c':
      copyAvif()
      break
    case 'a':
      openAddToCollection()
      break
    case 'l':
      likeContent()
      break
    case 'd':
      download()
      break
    default:
      // Any click that opens fullscreen autoplays (video only — gifs already
      // loop, images don't play), so clicking anywhere on a video plays it,
      // not just the center play overlay.
      if (isFullscreenModalVisible.value) isFullscreenModalVisible.value = false
      else openFullscreenWithAutoplay()
  }
}
</script>

<template>
  <template v-if="contentCount === 0" />
  <template v-else>
    <!-- Laid out from the start, invisible until the first media loads, skeleton
         overlaid — see CardBaseContent for why not display:none. -->
    <div class="relative">
      <div class="p-2.5 relative surface-card" :class="{ invisible: !initialLoaded }">
        <div v-if="showExtras" class="flex items-center gap-3 mb-1.5">
          <NuxtLink :to="titleHref" class="flex-1 min-w-0 flex items-center">
            <UTooltip :text="content.title" :disabled="!titleOverflows" :content="{ side: 'top' }">
              <UBadge
                ref="titleTagRef"
                color="neutral"
                variant="soft"
                icon="i-lucide-arrow-up-right"
                :label="content.title"
                :ui="{ label: 'card-title-label' }"
                class="rounded-full select-none cursor-pointer max-w-full truncate-tag hover:bg-night-700!"
                @vue:mounted="checkTitleOverflow"
              />
            </UTooltip>
          </NuxtLink>
          <div class="shrink-0 flex gap-2 items-center">
            <!-- Desktop only: the dot rail over the media says the same thing in
                 a better place on mobile, where the header row is already
                 title + badge + uploader chips. `sm` to match the arrows'
                 `hidden sm:block`. -->
            <UBadge
              v-if="hasMultiple"
              color="neutral"
              variant="solid"
              icon="i-lucide-images"
              :label="`${activeIndex + 1}/${contentCount}`"
              class="rounded-full select-none text-xs hidden sm:inline-flex"
            />
            <template v-if="!hideUploader && (content.expand as any)?.uploader">
              <UploaderChip
                v-for="u in (content.expand as any).uploader"
                :key="u.id"
                :uploader="u"
                @click="filtersApply(u, 'uploader')"
              />
            </template>
            <slot name="actions" />
          </div>
        </div>

        <div
          ref="mediaAreaRef"
          class="relative group hover:brightness-110 transition duration-300"
          :style="mediaMinHeight !== null ? { minHeight: `${mediaMinHeight}px` } : undefined"
          @click.stop.prevent="handleMediaClick"
          @contextmenu.prevent="handleContextMenu"
        >
          <!-- Placeholder shown while the next carousel item's media loads -->
          <div
            v-if="mediaMinHeight !== null"
            class="absolute inset-0 rounded-md bg-night-800 animate-pulse"
          />
          <!-- The active item and, once the person has stepped, its neighbours
               (see mountedContents). Hidden neighbours are the buffer for the
               next step; `prefetch` lets their video pull more than metadata. -->
          <CardMedia
            v-for="c in mountedContents"
            v-show="c.id === activeContent?.id"
            :key="c.id"
            :content="c"
            :aspect-ratio-override="setAspectRatio"
            :prefetch="c.id !== activeContent?.id"
            @loaded="onMediaLoaded(c.id)"
            @error="onMediaError(c.id)"
            @open-fullscreen="openFullscreenWithAutoplay"
          />

          <div
            v-if="hasMultiple"
            class="card-arrow-gradient card-arrow-gradient-left hidden sm:block"
            :class="{ 'card-arrow-gradient-video': activeContent?.filetype === 'video' }"
          >
            <button
              type="button"
              aria-label="Previous"
              class="card-arrow card-arrow-left"
              @click.stop.prevent="prevContent"
            >
              <UIcon name="i-lucide-chevron-left" class="card-arrow-icon" />
            </button>
          </div>
          <div
            v-if="hasMultiple"
            class="card-arrow-gradient card-arrow-gradient-right hidden sm:block"
            :class="{ 'card-arrow-gradient-video': activeContent?.filetype === 'video' }"
          >
            <button
              type="button"
              aria-label="Next"
              class="card-arrow card-arrow-right"
              @click.stop.prevent="nextContent"
            >
              <UIcon name="i-lucide-chevron-right" class="card-arrow-icon" />
            </button>
          </div>

          <CardLikeButton
            v-if="activeContent && showExtras"
            :liked="isLiked"
            :animating="isLikeAnimating"
            :count="likeCount"
            :allow-like-all="hasMultiple"
            @like="handleLike"
            @like-all="likeAllInSet"
          />

          <!-- Gated on hasMultiple only, NOT showExtras: the arrows above aren't
               gated on it either. Dots are navigation, not chrome — a
               no-distraction viewer still needs to know the card is swipeable. -->
          <div
            v-if="hasMultiple"
            class="card-dots"
            :class="{ 'card-dots-video': activeContent?.filetype === 'video' }"
          >
            <CardCarouselDots :count="contentCount" :index="activeIndex" />
          </div>
        </div>

        <CardChips
          v-if="activeContent && showExtras"
          :content="activeContent"
          @filters-apply="filtersApply"
        />
      </div>
      <SkeletonBaseContent v-if="!initialLoaded" class="absolute inset-0 overflow-hidden" />
    </div>

    <DialogBaseFullscreen
      v-if="isFullscreenModalVisible && activeContent"
      :is-visible="isFullscreenModalVisible"
      :content="activeContent"
      :next-content="nextInSet"
      :autoplay="autoplayInFullscreen"
      :has-navigation="hasMultiple"
      :count="contentCount"
      :index="activeIndex"
      :liked="isLiked"
      :like-animating="isLikeAnimating"
      :like-count="likeCount"
      @like="handleLike"
      @prev="prevContent"
      @next="nextContent"
      @update:is-visible="isFullscreenModalVisible = $event"
    />

    <!-- `scope-items` rather than a `scope`, for the same reason likeAllInSet
         passes sortedContents: the whole set is already here, so the modal's
         bulk add needs no fetch. -->
    <QuickCollectionModal
      v-if="isAddToCollectionVisible && activeContent"
      :is-visible="isAddToCollectionVisible"
      :content="activeContent"
      :scope-items="sortedContents"
      @update:is-visible="isAddToCollectionVisible = $event"
    />

    <QuickLabelModal
      v-if="isLabelsVisible && activeContent"
      :is-visible="isLabelsVisible"
      :content="activeContent"
      @update:is-visible="isLabelsVisible = $event"
      @changed="applyLabelsToContent(activeContent, $event)"
    />

    <DialogReport
      v-if="isReportVisible && activeContent"
      :is-visible="isReportVisible"
      :content-id="activeContent.id"
      @update:is-visible="isReportVisible = $event"
    />

    <ContentActionsMenu
      v-if="activeContent"
      ref="contentActionsMenuRef"
      :key="activeContent.id"
      :content="activeContent"
      @open-collections="openAddToCollection"
      @open-labels="openLabels"
      @open-report="openReport"
      @like-all-in-set="likeAllInSet"
    />

    <!-- Hidden behind ADMIN_MENU_KEY + right-click, and rendered for admins only
         so nobody else pays for the extra menu. Both halves are on hand here:
         the set is this card's record, the content is whichever the carousel is
         showing — which is exactly the one right-clicked. -->
    <AdminActionsMenu
      v-if="authStore.isAdmin"
      ref="adminMenuRef"
      :content="activeContent"
      :set="content"
      @changed="emit('changed')"
      @content-deleted="emit('changed')"
      @set-deleted="emit('changed')"
    />
  </template>
</template>

<style scoped>
/* Carousel arrows: gradient overlay passes clicks through to the oval
   (clip-path) button inside — neither is expressible as utilities. */
.card-arrow-gradient {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 5;
  width: 18%;
  min-width: 56px;
  max-width: 96px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
}

.card-arrow-gradient-left {
  left: 0;
  background: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.55) 0%,
    rgba(0, 0, 0, 0.15) 50%,
    transparent 100%
  );
}

.card-arrow-gradient-right {
  right: 0;
  background: linear-gradient(
    to left,
    rgba(0, 0, 0, 0.55) 0%,
    rgba(0, 0, 0, 0.15) 50%,
    transparent 100%
  );
}

/* Keep the arrows clear of the native video control bar. */
.card-arrow-gradient-video {
  bottom: 48px;
}

/* Position indicator, bottom-centre.
   z-10 sits above the arrow gradients (z-index: 5) and the height-lock
   placeholder, and below the like pill (z-20). */
.card-dots {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  pointer-events: none;
}

/* Same reason as .card-arrow-gradient-video above: clear the video controls.
   Slightly higher because the dots sit lower than the arrow gradient does. */
.card-dots-video {
  bottom: 56px;
}

.group:hover .card-arrow-gradient {
  opacity: 0.85;
}

.card-arrow {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  display: flex;
  align-items: center;
  background: transparent;
  color: white;
  border: none;
  cursor: pointer;
  padding: 0 14px;
  pointer-events: auto;
  clip-path: ellipse(50% 35% at 50% 50%);
}

.card-arrow > :deep(.card-arrow-icon) {
  font-size: 1.75rem;
  filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.6));
  transition: transform 0.2s;
}

.card-arrow-left {
  justify-content: flex-start;
}

.card-arrow-left:hover > :deep(.card-arrow-icon) {
  transform: scale(1.15) translateX(-2px);
}

.card-arrow-right {
  justify-content: flex-end;
}

.card-arrow-right:hover > :deep(.card-arrow-icon) {
  transform: scale(1.15) translateX(2px);
}
</style>
