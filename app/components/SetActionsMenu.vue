<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { CollectionsItem, SetsItem } from '~/types/appTypes'
import { computed, ref } from 'vue'

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

const pb = usePocketBase()
const toast = useToast()
const confirm = useConfirm()
const authStore = useAuthStore()

const isSetupVisible = ref(false)
const isSlideshowVisible = ref(false)
const isEditVisible = ref(false)

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

/**
 * Whether the signed-in user is one of the set's uploaders.
 *
 * Mirrors contents_sets.deleteRule (uploader.user ?= @request.auth.id). Needs
 * `uploader.user` in the expand, which SET_EXPAND and UNIFIED_SET_EXPAND both
 * already request. The rules and the propagate endpoint are the real gates —
 * this only decides whether to offer the action.
 */
const isSetUploader = computed(() => {
  const uploaders = ((props.content.expand as any)?.uploader ?? []) as any[]
  const userId = authStore.user?.id
  if (!userId) return false
  return [uploaders].flat().some((u: any) => u?.user === userId || u?.expand?.user?.id === userId)
})

const canEditSet = computed(
  () => props.isSet && authStore.canUpload && (isSetUploader.value || authStore.isAdmin),
)

const canDeleteSet = computed(
  () => props.isSet && authStore.canUpload && (isSetUploader.value || authStore.isAdmin),
)

async function deleteSet() {
  const count = ((props.content.expand as any)?.contents_via_set ?? []).length
  if (
    !(await confirm({
      title: 'Delete this set?',
      message: count
        ? `Its ${count} post${count === 1 ? '' : 's'} will be deleted too.`
        : "This can't be undone.",
      icon: 'i-lucide-trash-2',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      color: 'error',
    }))
  ) {
    return
  }
  try {
    // contents.set is cascadeDelete, so this takes the clips and their R2
    // objects with it — which is what the confirm message spells out.
    await pb.collection('contents_sets').delete(props.content.id)
    toast.add({ title: 'Set deleted', color: 'success', duration: 2000 })
    emit('deleted')
  } catch (error: any) {
    toast.add({
      title: "Couldn't delete set",
      description: error?.response?.message ?? 'Try again.',
      color: 'error',
      duration: 4000,
    })
  }
}

// computed so the label tracks isSet — this component serves collections too
// (CardStackedContent passes :is-set through).
const items = computed<DropdownMenuItem[]>(() => [
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
  // Set-only: this component also serves collections, which have their own
  // CollectionActionsMenu for editing and deleting.
  ...(canEditSet.value
    ? [
        {
          label: 'Edit set',
          icon: 'i-lucide-pencil',
          onSelect: () => {
            isEditVisible.value = true
          },
        },
      ]
    : []),
  ...(canDeleteSet.value
    ? [
        {
          label: 'Delete set',
          icon: 'i-lucide-trash-2',
          color: 'error' as const,
          onSelect: () => deleteSet(),
        },
      ]
    : []),
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

  <DialogSetEdit
    v-if="isEditVisible && isSet"
    :is-visible="isEditVisible"
    :set="content as SetsItem"
    @update:is-visible="isEditVisible = $event"
    @saved="emit('saved')"
  />
</template>
