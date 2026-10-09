<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ContentsItem } from '~/types/appTypes'
import { computed, ref } from 'vue'

/**
 * What can be done to a selection of posts, for SelectionActionBar's slot.
 *
 * Everyone can collect, label, download and copy what they selected; editing,
 * moving and deleting apply to the posts the viewer may manage (their own, or
 * any for admins) — the rest are skipped and the buttons say how many count.
 */
const props = defineProps<{ posts: ContentsItem[] }>()

const emit = defineEmits<{
  /** These finished; the page drops them from the selection and refetches. */
  processed: [doneIds: string[]]
}>()

const pb = usePocketBase()
const confirm = useConfirm()
const { run } = useBulkAction()
const { canManagePost } = useOwnership()
const { downloadAll } = useDownloadAll()
const { copyLinks } = useCopyLinks()

const mine = computed(() => props.posts.filter((p) => canManagePost(p)))
const inSets = computed(() => mine.value.filter((p) => !!p.set))
/** "3 of 5" when only some of the selection is manageable. */
const scope = computed(() =>
  mine.value.length === props.posts.length
    ? ''
    : ` (${mine.value.length} of ${props.posts.length})`,
)

const isEditVisible = ref(false)
const isMoveVisible = ref(false)
const isCollectVisible = ref(false)
const isLabelVisible = ref(false)

// Named handlers: an inline `x = true` evaluates to a boolean, which UButton's
// void-typed click rejects.
function openEdit() {
  isEditVisible.value = true
}
function openMove() {
  isMoveVisible.value = true
}

const plural = (n: number) => `${n} post${n === 1 ? '' : 's'}`

async function deleteAll() {
  const posts = mine.value
  const ok = await confirm({
    title: `Delete ${plural(posts.length)}?`,
    message: "This can't be undone.",
    icon: 'i-lucide-trash-2',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    color: 'error',
  })
  if (!ok) return
  const result = await run({
    items: posts,
    action: (p) => pb.collection('contents').delete(p.id, { requestKey: null }),
    progress: 'Deleting posts…',
    success: (n) => `Deleted ${plural(n)}`,
    failure: "Couldn't delete posts",
  })
  emit(
    'processed',
    result.done.map((p) => p.id),
  )
}

async function removeFromSets() {
  const posts = inSets.value
  const ok = await confirm({
    title: `Remove ${plural(posts.length)} from their sets?`,
    message: "The posts themselves won't be deleted.",
    icon: 'i-lucide-unlink',
    confirmLabel: 'Remove',
    cancelLabel: 'Cancel',
    color: 'warning',
  })
  if (!ok) return
  const result = await run({
    items: posts,
    action: (p) => pb.collection('contents').update(p.id, { set: '' }, { requestKey: null }),
    progress: 'Removing from sets…',
    success: (n) => `Removed ${plural(n)} from their sets`,
    failure: "Couldn't remove from sets",
  })
  emit(
    'processed',
    result.done.map((p) => p.id),
  )
}

function copy(kind: 'preview' | 'sd' | 'hd', label: string) {
  const urls = props.posts.map((p) => shortLink(p, kind)).filter((u): u is string => !!u)
  copyLinks(urls, label)
}

const more = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: 'Add to collection',
      icon: 'i-lucide-folder-plus',
      onSelect: () => (isCollectVisible.value = true),
    },
    { label: 'Add label', icon: 'i-lucide-tag', onSelect: () => (isLabelVisible.value = true) },
  ],
  [
    {
      label: 'Download HD',
      icon: 'i-lucide-download',
      onSelect: () => void downloadAll(props.posts, 'hd'),
    },
    {
      label: 'Download SD',
      icon: 'i-lucide-download',
      onSelect: () => void downloadAll(props.posts, 'sd'),
    },
    {
      label: 'Copy Discord links',
      icon: 'i-simple-icons-discord',
      onSelect: () => copy('preview', 'preview'),
    },
    { label: 'Copy HD links', icon: 'i-lucide-copy', onSelect: () => copy('hd', 'HD') },
    { label: 'Copy SD links', icon: 'i-lucide-copy', onSelect: () => copy('sd', 'SD') },
  ],
  ...(inSets.value.length
    ? [
        [
          {
            label: `Remove from set${scope.value}`,
            icon: 'i-lucide-unlink',
            onSelect: removeFromSets,
          },
        ],
      ]
    : []),
])
</script>

<template>
  <template v-if="mine.length">
    <UButton
      icon="i-lucide-pencil"
      :label="`Edit${scope}`"
      size="xs"
      color="neutral"
      variant="outline"
      @click="openEdit"
    />
    <UButton
      icon="i-lucide-folder-input"
      :label="`Move${scope}`"
      size="xs"
      color="neutral"
      variant="outline"
      @click="openMove"
    />
    <UButton
      icon="i-lucide-trash-2"
      :label="`Delete${scope}`"
      size="xs"
      color="error"
      variant="outline"
      @click="deleteAll"
    />
  </template>
  <UDropdownMenu :items="more" :content="{ side: 'top', align: 'end' }">
    <UButton icon="i-lucide-ellipsis" label="More" size="xs" color="neutral" variant="outline" />
  </UDropdownMenu>

  <DialogBulkEditPosts
    v-if="isEditVisible"
    :is-visible="isEditVisible"
    :posts="mine"
    @update:is-visible="isEditVisible = $event"
    @saved="emit('processed', $event)"
  />
  <DialogMoveToSet
    v-if="isMoveVisible"
    :is-visible="isMoveVisible"
    :posts="mine"
    @update:is-visible="isMoveVisible = $event"
    @moved="emit('processed', $event)"
  />
  <DialogBulkCollect
    v-if="isCollectVisible"
    :is-visible="isCollectVisible"
    :posts="posts"
    @update:is-visible="isCollectVisible = $event"
  />
  <DialogBulkLabel
    v-if="isLabelVisible"
    :is-visible="isLabelVisible"
    :posts="posts"
    @update:is-visible="isLabelVisible = $event"
  />
</template>
