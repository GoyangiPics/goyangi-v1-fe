<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import { computed, ref, watch } from 'vue'

/**
 * The /single/[id] detail view.
 *
 * Assembled from the same parts as CardBaseContent — DialogBaseFullscreen,
 * ContentActionsMenu, the quick-add modals — rather than its own parallel set of
 * controls. The page previously had none of them: no fullscreen, no labels, no
 * add-to-collection, no copy actions, no like-all, and clicking the media
 * navigated away to the raw R2 file. Reusing the card's parts also means a new
 * context-menu entry appears here without a second edit.
 *
 * Layout is media-left / details-right on desktop and stacked on mobile, with the
 * long tail of actions behind one button that opens the shared menu.
 */
const props = defineProps<{
  content: ContentsItem
  /** Live count from useViewCounter; the record's own `views` is pre-increment. */
  views?: number | null
}>()

const emit = defineEmits<{
  /** An admin edited this record — the page should refetch it. */
  changed: []
}>()

const router = useRouter()
// Home with the filter in the URL: the listing reads its filters from there,
// so a bare `/` would land unfiltered and undo the click.
const { to } = useNavTarget()
const { filtersApply } = useFilterApply(() => router.push(to('/')))
// `download` from here rather than a local one: it saves `original`, matching the
// context menu's Download, instead of whichever rendition the format setting is
// currently showing.
const { isLiked, isLikeAnimating, likeCount, handleLike, download } = useContentCard(props.content)
const { requireAuth } = useAuthGate()
const { likeAllIn } = useLikeAll()
const { videoSources, primaryUrl: contentUrl } = useContentSources(() => props.content)

const isAddToCollectionVisible = ref(false)
const isLabelsVisible = ref(false)
const isReportVisible = ref(false)
const isFullscreenVisible = ref(false)
const autoplayInFullscreen = ref(false)

const mediaAreaRef = ref<HTMLElement | null>(null)
const { menuRef: actionsMenuRef, adminMenuRef, onContextMenu } = useContextMenuTrigger(mediaAreaRef)
const authStore = useAuthStore()

/**
 * After an admin delete there is nothing left for this page to show.
 *
 * The set page when the item had one — that is where the neighbouring clips are
 * and where an admin working through a set wants to land — and home otherwise.
 */
function onContentDeleted() {
  router.push(props.content.set ? `/set/${props.content.set}` : '/')
}

/** The set is gone too, so its page would 404. */
function onSetDeleted() {
  router.push('/')
}

const isVideo = computed(() => props.content.filetype === 'video')
const isGif = computed(() => props.content.filetype === 'gif')
const setRecord = computed(() => (props.content.expand as any)?.set ?? null)
const collections = computed<any[]>(() => (props.content.expand as any)?.collections ?? [])
const origin = computed(() => contentOrigin(props.content))

const ORIGIN_BADGE: Record<
  NonNullable<ReturnType<typeof contentOrigin>>,
  { icon: string; color: 'primary' | 'neutral' | 'success'; label: string }
> = {
  direct: { icon: 'i-lucide-badge-check', color: 'primary', label: 'Direct upload' },
  imgur: { icon: 'i-simple-icons-imgur', color: 'success', label: 'Imported from imgur' },
  discord: { icon: 'i-simple-icons-discord', color: 'neutral', label: 'From Discord' },
}

/** Only rendered when at least one exists, rather than three disabled buttons. */
const externalLinks = computed(() =>
  [
    {
      key: 'discord',
      label: 'Discord',
      icon: 'i-simple-icons-discord',
      url: props.content.discord,
    },
    { key: 'source', label: 'Source', icon: 'i-lucide-link', url: props.content.source },
    { key: 'mirror', label: 'Imgur', icon: 'i-lucide-image', url: props.content.mirror },
  ].filter((l) => !!l.url?.trim()),
)

// All three write to PocketBase as the current user — anonymous visitors get the
// login prompt rather than an empty modal.
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

function openFullscreen() {
  // Autoplay only for video: gifs already loop and stills have nothing to play.
  autoplayInFullscreen.value = isVideo.value
  isFullscreenVisible.value = true
}

watch(isFullscreenVisible, (v) => {
  if (!v) autoplayInFullscreen.value = false
})

const moreButtonRef = ref<any>(null)

/**
 * The context menu stays the single source of truth for the long tail (the copy
 * variants, go-to-source, report, like-all), so this page opens it by button as
 * well as by right-click. Touch has long-press, but on a detail page a visible
 * control beats a hidden gesture.
 *
 * Anchored to the button's own rect rather than a click event: UButton's `click`
 * emit doesn't hand back a MouseEvent to read coordinates off, and anchoring
 * under the control is better placement than the pointer anyway.
 */
function openActionsMenu() {
  const el = (moreButtonRef.value?.$el ?? moreButtonRef.value) as HTMLElement | undefined
  const rect = el?.getBoundingClientRect?.()
  actionsMenuRef.value?.show({
    clientX: rect?.left ?? 0,
    clientY: rect?.bottom ?? 0,
  })
}

function likeAllInSet() {
  // See CardBaseContent: `live` keeps the like visible on the item on screen.
  if (props.content.set) likeAllIn({ setId: props.content.set }, { live: [props.content] })
}

function openExternal(url?: string) {
  if (url?.trim()) window.open(url, '_blank', 'noopener')
}
</script>

<template>
  <div class="w-full flex flex-col lg:flex-row gap-4 items-start">
    <!-- ── Media ─────────────────────────────────────────────────────── -->
    <div class="w-full lg:flex-1 min-w-0">
      <div class="surface-card p-2.5">
        <div class="flex items-center gap-2 mb-2 min-w-0">
          <h1 class="flex-1 min-w-0 truncate text-base font-semibold text-night-50">
            {{ content.title }}
          </h1>
          <NuxtLink
            v-if="content.set"
            :to="`/set/${content.set}`"
            class="shrink-0 flex items-center"
          >
            <UBadge
              color="neutral"
              variant="soft"
              icon="i-lucide-arrow-up-right"
              label="Set"
              class="rounded-full select-none cursor-pointer hover:bg-night-700!"
            />
          </NuxtLink>
        </div>

        <!--
          Right-click opens the shared menu here as it does on a card. On video
          that replaces the browser's own media menu, which is the same trade the
          cards already make.
        -->
        <div
          ref="mediaAreaRef"
          class="relative rounded-md overflow-hidden"
          @contextmenu.prevent="onContextMenu"
        >
          <!-- Native controls, so no click-to-fullscreen: it would fight every
               scrub and volume change. The Fullscreen button covers it. -->
          <video
            v-if="isVideo"
            class="rounded-md w-full video-hover-controls"
            :autoplay="false"
            :loop="false"
            controls
            playsinline
          >
            <source v-for="s in videoSources" :key="s.src" :src="s.src" :type="s.type" />
          </video>

          <video
            v-else-if="isGif"
            class="rounded-md w-full cursor-zoom-in"
            autoplay
            muted
            loop
            playsinline
            @click="openFullscreen"
          >
            <source v-for="s in videoSources" :key="s.src" :src="s.src" :type="s.type" />
          </video>

          <img
            v-else
            class="rounded-md w-full cursor-zoom-in"
            :src="contentUrl"
            :alt="content.title"
            @click="openFullscreen"
          />
        </div>

        <!-- The same chip row the cards use: idols, groups, tags, labels, dates,
             provenance — every one of them filter-applying on click. -->
        <CardChips :content="content" @filters-apply="filtersApply" />
      </div>
    </div>

    <!-- ── Details / actions ─────────────────────────────────────────── -->
    <aside class="w-full lg:w-80 shrink-0 flex flex-col gap-3">
      <div class="surface-card p-3 flex flex-col gap-2.5">
        <div class="flex items-center gap-2">
          <button
            type="button"
            :aria-label="isLiked ? 'Unlike' : 'Like'"
            class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-night-800 hover:bg-night-700 transition-all duration-200 cursor-pointer"
            @click="handleLike"
          >
            <span class="relative inline-flex">
              <span v-if="isLikeAnimating" class="cat-ear cat-ear-left" />
              <span v-if="isLikeAnimating" class="cat-ear cat-ear-right" />
              <UIcon
                name="i-lucide-heart"
                mode="svg"
                class="text-base"
                :class="[
                  isLiked ? 'text-pink-500 icon-filled' : 'text-white',
                  isLikeAnimating && 'heart-pop',
                ]"
              />
            </span>
            <span class="text-sm font-medium">{{ likeCount }}</span>
          </button>

          <ViewCountBadge v-if="typeof views === 'number'" :views="views" />

          <UButton
            icon="i-lucide-expand"
            label="Fullscreen"
            color="neutral"
            variant="outline"
            size="sm"
            class="ml-auto"
            @click="openFullscreen"
          />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <UButton
            icon="i-lucide-folder-plus"
            label="Collection"
            color="neutral"
            variant="outline"
            size="sm"
            block
            @click="openAddToCollection"
          />
          <UButton
            icon="i-lucide-tag"
            label="Add Label"
            color="neutral"
            variant="outline"
            size="sm"
            block
            @click="openLabels"
          />
          <UButton
            icon="i-lucide-download"
            label="Download"
            color="neutral"
            variant="outline"
            size="sm"
            block
            @click="download"
          />
          <UButton
            ref="moreButtonRef"
            icon="i-lucide-ellipsis"
            label="More"
            color="neutral"
            variant="outline"
            size="sm"
            block
            @click="openActionsMenu"
          />
        </div>
      </div>

      <div class="surface-card p-3 flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2">
          <span class="micro-label text-night-400">Uploader</span>
          <UploaderChip
            v-if="content.expand?.uploader"
            :uploader="content.expand.uploader"
            @click="filtersApply(content.expand.uploader, 'uploader')"
          />
          <UBadge
            v-else
            color="neutral"
            variant="soft"
            icon="i-lucide-user"
            label="Moderator"
            class="select-none"
          />
        </div>

        <!-- Answers the question the cards can't: absence of a Direct chip is not
             an obvious way to say "this came from Discord". -->
        <div v-if="origin" class="flex items-center justify-between gap-2">
          <span class="micro-label text-night-400">Origin</span>
          <UBadge
            :icon="ORIGIN_BADGE[origin].icon"
            :color="ORIGIN_BADGE[origin].color"
            variant="soft"
            :label="ORIGIN_BADGE[origin].label"
            class="select-none"
          />
        </div>

        <div class="flex items-center justify-between gap-2">
          <span class="micro-label text-night-400">Type</span>
          <UBadge
            color="neutral"
            variant="soft"
            icon="i-lucide-file"
            :label="content.filetype || 'unknown'"
            class="select-none"
          />
        </div>

        <!-- The name the file arrived with. People name files deliberately, and
             it was the one piece of provenance nothing kept — PocketBase renames
             on save and the encode hook deletes the source. -->
        <div v-if="content.filename" class="flex items-start justify-between gap-2">
          <span class="micro-label text-night-400 shrink-0">File</span>
          <span
            class="text-xs text-night-300 font-mono text-right break-all"
            :title="content.filename"
          >
            {{ content.filename }}
          </span>
        </div>

        <div class="flex items-center justify-between gap-2">
          <span class="micro-label text-night-400">Uploaded</span>
          <span class="text-xs text-night-300 font-mono">
            {{ formatShortDate(content.created) }}
          </span>
        </div>

        <div v-if="content.date" class="flex items-center justify-between gap-2">
          <span class="micro-label text-night-400">Content date</span>
          <span class="text-xs text-night-300 font-mono">
            {{ formatShortDate(content.date) }}
          </span>
        </div>

        <div v-if="setRecord" class="flex items-start justify-between gap-2">
          <span class="micro-label text-night-400 mt-1">Set</span>
          <NuxtLink :to="`/set/${content.set}`" class="max-w-52 min-w-0">
            <UBadge
              icon="i-lucide-film"
              color="success"
              variant="soft"
              :label="setRecord.title"
              class="select-none cursor-pointer hover:bg-green-900! max-w-full truncate"
            />
          </NuxtLink>
        </div>

        <div v-if="collections.length" class="flex flex-col gap-1.5">
          <span class="micro-label text-night-400">Appears in</span>
          <div class="flex flex-wrap gap-1.5">
            <NuxtLink
              v-for="collection in collections"
              :key="collection.id"
              :to="`/collection/${collection.id}`"
            >
              <UBadge
                icon="i-lucide-folder"
                color="success"
                variant="soft"
                :label="collection.title"
                class="select-none cursor-pointer hover:bg-green-900!"
              />
            </NuxtLink>
          </div>
        </div>
      </div>

      <div v-if="externalLinks.length" class="surface-card p-3 flex flex-col gap-2">
        <span class="micro-label text-night-400">External</span>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="link in externalLinks"
            :key="link.key"
            :icon="link.icon"
            :label="link.label"
            color="neutral"
            variant="outline"
            size="sm"
            @click="openExternal(link.url)"
          />
        </div>
      </div>

      <UButton
        icon="i-lucide-flag"
        label="Report"
        color="error"
        variant="ghost"
        size="sm"
        class="self-start"
        @click="openReport"
      />
    </aside>
  </div>

  <DialogBaseFullscreen
    v-if="isFullscreenVisible"
    :is-visible="isFullscreenVisible"
    :content="content"
    :autoplay="autoplayInFullscreen"
    :liked="isLiked"
    :like-animating="isLikeAnimating"
    :like-count="likeCount"
    @like="handleLike"
    @update:is-visible="isFullscreenVisible = $event"
  />

  <!-- See CardBaseContent: `scope` offers the "add all contents from set"
       checkbox, `live` keeps the bulk add visible on the item on screen. -->
  <QuickCollectionModal
    v-if="isAddToCollectionVisible"
    :is-visible="isAddToCollectionVisible"
    :content="content"
    :scope="content.set ? { setId: content.set } : undefined"
    :live="[content]"
    @update:is-visible="isAddToCollectionVisible = $event"
  />

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
    ref="actionsMenuRef"
    :content="content"
    @open-collections="openAddToCollection"
    @open-labels="openLabels"
    @open-report="openReport"
    @like-all-in-set="likeAllInSet"
  />

  <!-- Hidden behind ADMIN_MENU_KEY + right-click, admins only. Unlike a card in
       a listing, this page IS the record — a delete has to navigate, not refetch. -->
  <AdminActionsMenu
    v-if="authStore.isAdmin"
    ref="adminMenuRef"
    :content="content"
    :set-id="content.set || null"
    @changed="emit('changed')"
    @content-deleted="onContentDeleted"
    @set-deleted="onSetDeleted"
  />
</template>
