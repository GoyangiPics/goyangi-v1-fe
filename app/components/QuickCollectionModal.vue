<script setup lang="ts">
/**
 * The app's one "add to collection" modal.
 *
 * It opens in two shapes, which is what the optional `content` prop selects:
 *
 *  - **Item.** `content` is the clicked record. The picker seeds from its
 *    current membership; unticks remove (that item only), and what ticks mean
 *    depends on the checkbox — item-only ticks are a diff, bulk covers every
 *    ticked collection (see handleSave).
 *  - **Scope.** No `content`, only a set or collection to act across (the set
 *    page header, a set card's menu). Nothing is seeded, so there is nothing to
 *    untick and the save is purely additive.
 *
 * The "add all contents" checkbox is what makes the item shape cover the bulk
 * case too, rather than a second dialog beside this one. It governs ADDS ONLY:
 * unticking a collection always removes just the clicked item, so there is no
 * gesture here that can strip a 200-item set out of a collection by accident.
 */
import type { ContentsItem } from '~/types/appTypes'
import { computed, onMounted, ref } from 'vue'

const props = defineProps<{
  isVisible: boolean
  /** The clicked record. Absent for a set- or collection-level open. */
  content?: ContentsItem
  /**
   * What "all contents" covers. Absent when there is nothing to apply across,
   * which is also what hides the checkbox.
   */
  scope?: { setId: string } | { collectionId: string }
  /** The scope's items when the caller already holds them — saves a fetch. */
  scopeItems?: ContentsItem[]
  /** Rendered instances to keep in step when `scope` has to be fetched. */
  live?: ContentsItem[]
  /** Completes "Add all contents from this …". */
  scopeLabel?: string
}>()

const emit = defineEmits(['update:isVisible'])

/** Sticky across opens: unticking it once should stay unticked. */
const ADD_ALL_PREF_KEY = 'addAllFromSet'

const toast = useToast()
const { addToCollections, removeFromCollections } = useCollectionApi()
const { isAddingAll, addAllItems, addAllIn } = useAddAllToCollection()

const selectedCollections = ref<string[]>([])
const originalCollectionIds = ref<string[]>([])
const addAll = ref(true)

const isSaving = ref(false)

const hasScope = computed(() => !!props.scope || !!props.scopeItems?.length)
/** No clicked record to fall back to, so "all" isn't optional here. */
const isScopeOnly = computed(() => !props.content)

const scopeNoun = computed(() => props.scopeLabel ?? 'set')

onMounted(() => {
  originalCollectionIds.value = props.content?.collections ?? []
  selectedCollections.value = [...originalCollectionIds.value]

  if (isScopeOnly.value) {
    addAll.value = true
    return
  }
  // localStorage only exists client-side, and this modal is v-if'd, so mount
  // *is* the open — no SSR/first-render mismatch to worry about. Default on:
  // the whole point of the checkbox is that adding one item of a set is
  // usually not what was meant.
  addAll.value = localStorage.getItem(ADD_ALL_PREF_KEY) !== 'false'
})

/**
 * Written on toggle rather than on save, so the choice sticks even if the modal
 * is then cancelled — "unchecked once" should mean unchecked next time.
 */
function onAddAllChange(value: boolean) {
  addAll.value = value
  localStorage.setItem(ADD_ALL_PREF_KEY, String(value))
}

async function handleSave() {
  const added = selectedCollections.value.filter((id) => !originalCollectionIds.value.includes(id))
  const removed = originalCollectionIds.value.filter(
    (id) => !selectedCollections.value.includes(id),
  )

  const bulk = addAll.value && hasScope.value
  // With the box ticked, the bulk pass covers EVERY ticked collection, not just
  // the newly ticked. Diffing against the clicked item's membership left a gap:
  // a collection the item was already in came pre-ticked, so it could never
  // enter `added`, and "add the rest of the set to X" was unreachable from any
  // item already in X — the only gesture that touched X was the untick, which
  // REMOVES the item. Idempotent to re-run: the composable skips per item, so a
  // set already in X reports "already there" and writes nothing.
  const toAdd = bulk ? [...selectedCollections.value] : added

  if (!toAdd.length && !removed.length) {
    emit('update:isVisible', false)
    return
  }

  isSaving.value = true
  try {
    const item = props.content

    // Removals are always item-only — see the note at the top.
    if (item && removed.length) {
      await removeFromCollections(item.id, removed)
      item.collections = (item.collections ?? []).filter((id) => !removed.includes(id))
    }

    // With the box ticked the clicked item is simply one of the scope's members,
    // so its own add rides along with the bulk pass rather than being written
    // twice — and useAddAllToCollection owns the messaging in that case.
    if (toAdd.length && bulk) {
      const result = props.scopeItems
        ? await addAllItems(props.scopeItems, toAdd)
        : await addAllIn(props.scope!, toAdd, { live: props.live })
      // Null is the auth gate or a failed load. Stay open: closing would throw
      // away the picked collections along with the toast's context.
      if (!result) return
    } else {
      if (item && toAdd.length) {
        await addToCollections(item.id, toAdd)
        item.collections = [...(item.collections ?? []), ...toAdd]
      }
      toast.add({
        title: 'Collections updated',
        color: 'success',
        duration: 2000,
      })
    }

    emit('update:isVisible', false)
  } catch {
    toast.add({
      title: "Couldn't update collections",
      description: 'Try again.',
      color: 'error',
      duration: 3000,
    })
  } finally {
    isSaving.value = false
  }
}

function handleHide() {
  emit('update:isVisible', false)
}
</script>

<template>
  <UModal
    :open="isVisible"
    title="Add to collection"
    :ui="{ content: 'sm:max-w-md' }"
    @update:open="emit('update:isVisible', $event)"
  >
    <template #body>
      <CollectionPicker v-model="selectedCollections" class="mb-4" />

      <!-- Disabled rather than hidden in the scope-only shape: there is no
           clicked item to fall back to, so showing what will happen beats
           silently doing it. -->
      <div v-if="hasScope" class="mb-4 rounded-lg border border-white/10 px-3 py-2.5">
        <UCheckbox
          :model-value="addAll"
          :disabled="isScopeOnly"
          :label="`Add all posts in this ${scopeNoun}`"
          @update:model-value="onAddAllChange($event as boolean)"
        />
        <p class="mt-1 pl-6 text-xs text-night-500">
          <template v-if="isScopeOnly"> Every post, not just the ones on this page. </template>
          <template v-else> Unticking a collection only removes this post. </template>
        </p>
      </div>

      <!-- Footer -->
      <div class="flex gap-3">
        <UButton label="Cancel" color="neutral" block @click="handleHide" />
        <UButton
          label="Save"
          color="success"
          block
          :loading="isSaving || isAddingAll"
          @click="handleSave"
        />
      </div>
    </template>
  </UModal>
</template>
