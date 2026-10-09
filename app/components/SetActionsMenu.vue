<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { CollectionsItem, SetsItem } from '~/types/appTypes'
import { computed, ref, shallowRef } from 'vue'

const props = defineProps<{
  content: SetsItem | CollectionsItem
  isSet: boolean
  /**
   * Render a visible wrench trigger instead of only opening on right-click.
   *
   * List rows need this: a card can be right-clicked, but a dense row has no
   * obvious surface for it, and without a trigger this component renders an
   * invisible menu with no way in.
   */
  withTrigger?: boolean
}>()

const emit = defineEmits<{
  saved: []
  deleted: []
}>()

const isSetupVisible = ref(false)
const isSlideshowVisible = ref(false)

const slideshowOptions = ref({
  columns: 1,
  randomize: false,
  loopsPerContent: 1,
})

// Programmatic context menu: parents call `show(event)` (right-click or
// long-press) and the menu opens anchored to a virtual element at the
// pointer position. Registered with the global single-open-menu registry.
const { open, reference, show } = useContextMenuAnchor()

defineExpose({ show })

function onSlideshowStart(opts: { columns: number; randomize: boolean; loopsPerContent: number }) {
  slideshowOptions.value = opts
  isSlideshowVisible.value = true
}

// CardStackedContent's data (SET_EXPAND) does not expand
// contents_via_set.likes, so unlike CardUnified there is nothing to reuse and
// this menu owns the fetch.
const { likeAllIn } = useLikeAll()

// Unlike Like All, this can't fire on select — it has to ask which collection.
// It opens the same modal a content card does, in its scope-only shape: there is
// no single clicked item here, so "add all contents" is the only thing it can
// mean and the checkbox says so.
const isAddToCollectionVisible = ref(false)

// Edit / delete for owners and admins — sets only; collections have
// CollectionActionsMenu. Shared sets offer "delete my posts" instead.
// shallowRef: a deep ref's type unwrapping of DropdownMenuItem overflows tsc.
const manageRef = shallowRef<{ groups: DropdownMenuItem[][] } | null>(null)

// computed so the label tracks isSet — this component serves collections too
// (CardStackedContent passes :is-set through).
const baseItems = computed<DropdownMenuItem[]>(() => [
  {
    label: 'Play slideshow',
    icon: 'i-lucide-circle-play',
    onSelect: () => {
      isSetupVisible.value = true
    },
  },
  {
    // No "…In Set"/"…In Collection" split: the menu is already anchored to the
    // thing it acts on, so the distinction only made the label longer.
    label: 'Like all',
    icon: 'i-lucide-heart',
    onSelect: () =>
      props.isSet
        ? likeAllIn({ setId: props.content.id })
        : likeAllIn({ collectionId: props.content.id }),
  },
  {
    label: 'Add to collection',
    icon: 'i-lucide-folder-plus',
    onSelect: () => {
      isAddToCollectionVisible.value = true
    },
  },
])

const items = computed<DropdownMenuItem[][]>(() => [
  baseItems.value,
  ...(props.isSet ? (manageRef.value?.groups ?? []) : []),
])
</script>

<template>
  <UDropdownMenu
    v-model:open="open"
    :items="items"
    :modal="false"
    :content="
      withTrigger
        ? { side: 'bottom', align: 'end', sideOffset: 4 }
        : { reference, side: 'bottom', align: 'start', sideOffset: 2 }
    "
  >
    <!-- Default slot only when asked for: leaving it empty is what makes the
         right-click-only mode work (the menu has no trigger to anchor to). -->
    <UButton
      v-if="withTrigger"
      icon="i-lucide-wrench"
      color="info"
      size="xs"
      square
      class="rounded-full shadow-lg"
      aria-label="Set actions"
    />
  </UDropdownMenu>

  <QuickCollectionModal
    v-if="isAddToCollectionVisible"
    :is-visible="isAddToCollectionVisible"
    :scope="isSet ? { setId: content.id } : { collectionId: content.id }"
    :scope-label="isSet ? 'set' : 'collection'"
    @update:is-visible="isAddToCollectionVisible = $event"
  />

  <DialogSlideshowSetup
    v-if="isSetupVisible"
    :is-visible="isSetupVisible"
    :title="content.title"
    @update:is-visible="isSetupVisible = $event"
    @start="onSlideshowStart"
  />

  <DialogSlideshow
    v-if="isSlideshowVisible"
    :is-visible="isSlideshowVisible"
    :content="content"
    :is-set="isSet"
    :columns="slideshowOptions.columns"
    :randomize="slideshowOptions.randomize"
    :loops-per-content="slideshowOptions.loopsPerContent"
    @update:is-visible="isSlideshowVisible = $event"
  />

  <ManageActions
    v-if="isSet"
    ref="manageRef"
    :set="content as SetsItem"
    @changed="emit('saved')"
    @set-deleted="emit('deleted')"
  />
</template>
