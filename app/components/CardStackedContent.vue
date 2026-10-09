<script setup lang="ts">
import type { CollectionsItem, SetsItem } from '~/types/appTypes'
import { computed, ref } from 'vue'

const props = defineProps<{
  content: SetsItem | CollectionsItem
  isSet: boolean
  showVisibility?: boolean
}>()

const emit = defineEmits(['filtersApply', 'changed'])

const authStore = useAuthStore()
const { filtersApply } = useFilterApply(() => emit('filtersApply'))
const { titleTagRef, titleOverflows, checkTitleOverflow } = useTitleOverflow()

const mediaAreaRef = ref<HTMLElement | null>(null)
const {
  menuRef: setActionsMenuRef,
  adminMenuRef,
  onContextMenu: handleContextMenu,
} = useContextMenuTrigger(mediaAreaRef)

// Up to 4 thumbnails from the set/collection's expanded contents.
//
// contentThumbUrl rather than a bare `item.static`: static is best-effort on the
// backend and stickers never get one, so mapping it directly and filtering
// falsy values silently rendered a 4-item set as a single tile.
const previewUrls = computed<string[]>(() => {
  const contentField = props.isSet ? 'contents_via_set' : 'contents_via_collections'
  const items = ((props.content?.expand as any)?.[contentField] ?? []) as any[]
  return items.slice(0, 4).map(contentThumbUrl).filter(Boolean)
})

// Uploader can arrive as a single record or an array depending on expand.
const uploaders = computed<any[]>(() => {
  const u = (props.content.expand as any)?.uploader
  return u ? [u].flat() : []
})

// A one-item set skips its own listing page — see setHref. Collections never do.
const href = computed(() =>
  props.isSet ? setHref(props.content) : `/collection/${props.content.id}`,
)

/**
 * Handed off to the destination page's PageHandoffTitle. The media area is a
 * real link, so this only runs on a plain click; a middle-click or "open in new
 * tab" skips it and the destination simply fetches its own title.
 */
function stashTitle() {
  localStorage.setItem('pageTitle', props.content.title)
}
</script>

<template>
  <div class="stack-wrapper">
    <div class="stack-card surface-card">
      <div class="flex items-center gap-3 mb-1.5">
        <NuxtLink :to="href" class="flex-1 min-w-0 flex items-center">
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
          <UBadge
            v-if="showVisibility"
            :label="(content as any).isPublic ? 'Public' : 'Private'"
            :color="(content as any).isPublic ? 'info' : 'neutral'"
            variant="soft"
            :icon="(content as any).isPublic ? 'i-lucide-globe' : 'i-lucide-lock'"
            class="select-none"
          />
          <div v-if="uploaders.length" class="flex items-center gap-2">
            <UploaderChip
              v-for="u in uploaders"
              :key="u.id"
              :uploader="u"
              @click="filtersApply(u, 'uploader')"
            />
          </div>
          <div v-else-if="(content.expand as any)?.user">
            <UBadge
              v-for="user in (content.expand as any).user"
              :key="user.id"
              color="success"
              variant="soft"
              icon="i-lucide-user"
              :label="displayName(user.name)"
              class="rounded-full select-none"
            />
          </div>
          <slot name="actions" />
        </div>
      </div>

      <!-- A link rather than a click handler so middle/ctrl-click open a tab.
           Right-click stays the set's own actions menu, as before, and the
           touch-callout rule keeps iOS from putting its link preview sheet over
           the long-press version of that menu. -->
      <NuxtLink
        ref="mediaAreaRef"
        :to="href"
        class="block cursor-pointer group relative [-webkit-touch-callout:none]"
        @click="stashTitle"
        @contextmenu.prevent="handleContextMenu"
      >
        <img
          v-if="(content as any).cover"
          loading="lazy"
          class="w-full h-auto rounded-md group-hover:brightness-110 transition duration-300"
          :src="(content as any).cover"
          alt="Preview"
        />
        <div
          v-else
          class="grid grid-cols-2 gap-1.5 group-hover:brightness-110 transition duration-300"
        >
          <div v-for="(url, index) in previewUrls" :key="index" class="rounded-md overflow-hidden">
            <img loading="lazy" class="w-full h-auto rounded-md" :src="url" alt="Preview" />
          </div>
        </div>
      </NuxtLink>

      <CardChips :content="content" simple-date @filters-apply="filtersApply" />
    </div>
  </div>

  <!-- Bubbled up so the listing page can refetch: an edit can change the title
       and idols shown on this card, and a delete removes it entirely. -->
  <SetActionsMenu
    ref="setActionsMenuRef"
    :content="content"
    :is-set="isSet"
    @saved="emit('changed')"
    @deleted="emit('changed')"
  />

  <!-- Hidden behind ADMIN_MENU_KEY + right-click. Sets only: a collection is its
       owner's, and CollectionActionsMenu already covers editing and deleting one. -->
  <AdminActionsMenu
    v-if="authStore.isAdmin && isSet"
    ref="adminMenuRef"
    :set="content as SetsItem"
    @changed="emit('changed')"
    @set-deleted="emit('changed')"
  />
</template>

<style>
/* Truncation, speed-dial buttons and the date-tag base style are global
   (app/assets/cards.css). Only stack-specific layout lives here. */
.stack-wrapper {
  position: relative;
  margin-right: 6px;
  margin-bottom: 6px;
}

.stack-wrapper::before,
.stack-wrapper::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 12px;
  z-index: -1;
  pointer-events: none;
}

.stack-wrapper::before {
  background: var(--color-night-800);
  transform: translate(3px, 3px);
}

.stack-wrapper::after {
  background: var(--color-night-700);
  transform: translate(6px, 6px);
  opacity: 0.5;
}

.stack-card {
  position: relative;
  padding: 8px;
}
</style>
