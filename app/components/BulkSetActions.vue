<script setup lang="ts">
import type { SetsItem } from '~/types/appTypes'
import { computed, ref } from 'vue'
import { setDeleteMode } from '~/utils/ownership'

/**
 * What can be done to a selection of sets, for SelectionActionBar's slot.
 *
 * Delete follows the single-set rule per set: the whole set when every post in
 * it is yours (or you're an admin), only your posts in a shared one.
 */
const props = defineProps<{ sets: SetsItem[] }>()

const emit = defineEmits<{ processed: [doneIds: string[]] }>()

const pb = usePocketBase()
const confirm = useConfirm()
const { run } = useBulkAction()
const { viewer, canManageSet, setPostCounts } = useOwnership()
const { downloadAllIn } = useDownloadAll()

const mine = computed(() => props.sets.filter((s) => canManageSet(s as any)))
const scope = computed(() =>
  mine.value.length === props.sets.length ? '' : ` (${mine.value.length} of ${props.sets.length})`,
)

const isMergeVisible = ref(false)
const isEditVisible = ref(false)

function openEdit() {
  isEditVisible.value = true
}
function openMerge() {
  isMergeVisible.value = true
}

const plural = (n: number) => `${n} set${n === 1 ? '' : 's'}`

async function deleteOne(set: SetsItem) {
  const counts = await setPostCounts(set.id)
  const mode = setDeleteMode(counts, viewer.value)
  if (mode === 'set') {
    await pb.collection('contents_sets').delete(set.id, { requestKey: null })
    return
  }
  if (mode === 'none') throw new Error('Nothing of yours in this set')
  const posts = await pb.collection('contents').getFullList({
    filter: pb.filter('set = {:id} && uploader = {:up}', {
      id: set.id,
      up: viewer.value.uploaderId,
    }),
    fields: 'id',
    requestKey: null,
  })
  for (const p of posts) await pb.collection('contents').delete(p.id, { requestKey: null })
}

async function deleteAll() {
  const sets = mine.value
  const ok = await confirm({
    title: `Delete ${plural(sets.length)}?`,
    message:
      'Their posts are deleted too. In sets shared with other uploaders, only your posts are. ' +
      "This can't be undone.",
    icon: 'i-lucide-trash-2',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    color: 'error',
  })
  if (!ok) return
  const result = await run({
    items: sets,
    action: deleteOne,
    // Each delete cascades through every post and holds the database's write
    // lock, which uploads need too — one at a time.
    concurrency: 1,
    progress: 'Deleting sets…',
    success: (n) => `Deleted ${plural(n)}`,
    failure: "Couldn't delete sets",
  })
  emit(
    'processed',
    result.done.map((s) => s.id),
  )
}

async function downloadAll() {
  for (const set of props.sets) await downloadAllIn({ setId: set.id }, 'hd')
}

const canMerge = computed(() => mine.value.length >= 2 && mine.value.length === props.sets.length)
</script>

<template>
  <UButton
    v-if="mine.length === 1 && sets.length === 1"
    icon="i-lucide-pencil"
    label="Edit"
    size="xs"
    color="neutral"
    variant="outline"
    @click="openEdit"
  />
  <UButton
    v-if="canMerge"
    icon="i-lucide-merge"
    label="Merge"
    size="xs"
    color="neutral"
    variant="outline"
    @click="openMerge"
  />
  <UButton
    icon="i-lucide-download"
    label="Download"
    size="xs"
    color="neutral"
    variant="outline"
    @click="downloadAll"
  />
  <UButton
    v-if="mine.length"
    icon="i-lucide-trash-2"
    :label="`Delete${scope}`"
    size="xs"
    color="error"
    variant="outline"
    @click="deleteAll"
  />

  <DialogAdminMergeSets
    v-if="isMergeVisible"
    :is-visible="isMergeVisible"
    :sets="sets as any"
    @update:is-visible="isMergeVisible = $event"
    @merged="
      emit(
        'processed',
        sets.map((s) => s.id),
      )
    "
  />
  <DialogSetEdit
    v-if="isEditVisible && sets[0]"
    :is-visible="isEditVisible"
    :set="sets[0] as any"
    @update:is-visible="isEditVisible = $event"
    @saved="emit('processed', [])"
  />
</template>
