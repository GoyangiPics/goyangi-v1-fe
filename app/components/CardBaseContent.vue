<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  content: ContentsItem
  hideUploader?: boolean
  hideSet?: boolean
  /**
   * The page hosts one fullscreen viewer for the whole listing (see
   * useListingFullscreen), so this card emits `openFullscreen` instead of
   * opening its own single-item dialog. That is what gives the set page,
   * the collection page and the ungrouped home grid prev/next.
   */
  fullscreenHost?: boolean
}>()

const emit = defineEmits(['filtersApply', 'changed', 'openFullscreen'])

const settingsStore = useSettingsStore()
const authStore = useAuthStore()

const { filtersApply } = useFilterApply(() => emit('filtersApply'))
const { titleTagRef, titleOverflows, checkTitleOverflow } = useTitleOverflow()
const { isLiked, likeContent, isLikeAnimating, likeCount, handleLike, copyAvif, download } =
  useContentCard(props.content)
const { activeKey } = useKeyboardShortcuts()
const { requireAuth } = useAuthGate()

const showExtras = computed(() => settingsStore.settings.noDistractionMode === 'Disabled')

const loaded = ref(false)

const isAddToCollectionVisible = ref(false)
const isLabelsVisible = ref(false)
const isFullscreenModalVisible = ref(false)
const isReportVisible = ref(false)
const autoplayInFullscreen = ref(false)

// Both write to PocketBase as the current user — anonymous visitors get the
// login prompt instead of an empty modal.
function openAddToCollection() {
  if (!requireAuth('add posts to a collection')) return
  isAddToCollectionVisible.value = true
}

function openLabels() {
  if (!requireAuth('add labels')) return
  isLabelsVisible.value = true
}

function openReport() {
  if (!requireAuth('report posts')) return
  isReportVisible.value = true
}

function openFullscreenWithAutoplay() {
  if (props.fullscreenHost) {
    emit('openFullscreen', props.content, true)
    return
  }
  autoplayInFullscreen.value = true
  isFullscreenModalVisible.value = true
}

watch(isFullscreenModalVisible, (v) => {
  if (!v) autoplayInFullscreen.value = false
})

const mediaAreaRef = ref<HTMLElement | null>(null)
const { menuRef: contentActionsMenuRef, onContextMenu: handleContextMenu } =
  useContextMenuTrigger(mediaAreaRef)

// F opens this post fullscreen while the cursor is over it.
useHoverFullscreenKey(mediaAreaRef, () => openFullscreenWithAutoplay())

// Unlike CardUnified, this card holds a single item, so the set has to be
// fetched rather than reused from an expand.
const { likeAllIn } = useLikeAll()

function likeAllInSet() {
  // `live`: this card's own item is one of the set's, so hand it over rather than
  // letting the like land on a fetched copy and leave this heart white.
  if (props.content.set) likeAllIn({ setId: props.content.set }, { live: [props.content] })
}

watch(
  () => props.content.title,
  () => nextTick(checkTitleOverflow),
)
watch(loaded, (v) => {
  if (v) nextTick(checkTitleOverflow)
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
  <!-- The card is laid out from the start and merely invisible until its media
       loads, with the skeleton overlaid. It used to be display:none, which gave
       a lazy-loading image no layout box — and an image with no box never
       loads, so the skeleton never lifted. The media box already reserves the
       right aspect ratio, so the card's height is real before the file arrives. -->
  <div class="relative">
    <div class="p-2.5 relative surface-card" :class="{ invisible: !loaded }">
      <div v-if="showExtras" class="flex items-center gap-3 mb-1.5">
        <NuxtLink :to="`/single/${content.id}`" class="flex-1 min-w-0 flex items-center">
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
        <div class="shrink-0 flex items-center gap-2">
          <NuxtLink
            v-if="content.set && !hideSet"
            :to="`/set/${content.set}`"
            class="flex items-center"
          >
            <UBadge
              color="neutral"
              variant="soft"
              icon="i-lucide-arrow-up-right"
              label="Set"
              class="rounded-full select-none cursor-pointer hover:bg-night-700!"
            />
          </NuxtLink>
          <UploaderChip
            v-if="content.expand?.uploader && !hideUploader"
            :uploader="content.expand.uploader"
            @click="filtersApply(content.expand.uploader, 'uploader')"
          />
          <slot name="actions" />
        </div>
      </div>

      <div
        ref="mediaAreaRef"
        class="relative group hover:brightness-110 transition duration-300"
        @click.stop.prevent="handleMediaClick"
        @contextmenu.prevent="handleContextMenu"
      >
        <CardMedia
          :content="content"
          @loaded="loaded = true"
          @error="loaded = true"
          @open-fullscreen="openFullscreenWithAutoplay"
        />
        <CardLikeButton
          v-if="showExtras"
          :liked="isLiked"
          :animating="isLikeAnimating"
          :count="likeCount"
          @like="handleLike"
        />
      </div>

      <CardChips v-if="showExtras" :content="content" @filters-apply="filtersApply" />
    </div>
    <SkeletonBaseContent v-if="!loaded" class="absolute inset-0 overflow-hidden" />
  </div>

  <DialogBaseFullscreen
    v-if="isFullscreenModalVisible && !fullscreenHost"
    :is-visible="isFullscreenModalVisible"
    :content="content"
    :autoplay="autoplayInFullscreen"
    :liked="isLiked"
    :like-animating="isLikeAnimating"
    :like-count="likeCount"
    @like="handleLike"
    @update:is-visible="isFullscreenModalVisible = $event"
  />

  <!-- `scope` is what puts the "add all contents from set" checkbox in the
       modal. `live`: this card's item is one of the set's, so hand it over
       rather than letting the bulk add land on a fetched copy. -->
  <QuickCollectionModal
    v-if="isAddToCollectionVisible"
    :is-visible="isAddToCollectionVisible"
    :content="content"
    :scope="content.set ? { setId: content.set } : undefined"
    :live="[content]"
    @update:is-visible="isAddToCollectionVisible = $event"
  />

  <!-- No refetch on change: the chip row reads content.expand.labels, which the
       backend hook updates, so the new label appears on the next load. Firing
       the page's filter-apply here would rewrite the URL and toast "Filters
       applied", which is not what adding a label means. -->
  <QuickLabelModal
    v-if="isLabelsVisible"
    :is-visible="isLabelsVisible"
    :content="content"
    @update:is-visible="isLabelsVisible = $event"
    @changed="applyLabelsToContent(content, $event)"
  />

  <DialogReport
    v-if="isReportVisible"
    :is-visible="isReportVisible"
    :content-id="content.id"
    @update:is-visible="isReportVisible = $event"
  />

  <ContentActionsMenu
    ref="contentActionsMenuRef"
    :content="content"
    @changed="emit('changed')"
    @content-deleted="emit('changed')"
    @set-deleted="emit('changed')"
    @open-collections="openAddToCollection"
    @open-labels="openLabels"
    @open-report="openReport"
    @like-all-in-set="likeAllInSet"
  />
</template>

<!-- Shared card styles (animations, truncation, video controls, etc.) live
     in app/assets/cards.css so they're available regardless of which card
     component is mounted. -->
