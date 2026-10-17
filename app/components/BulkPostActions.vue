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

/** Each kind of link the selection can copy, for the posts that have one. */
const links = computed(() => {
  const short = (kind: 'preview' | 'sd' | 'hd') =>
    props.posts.map((p) => shortLink(p, kind)).filter((u): u is string => !!u)
  return {
    // `mirror` holds imgur links and nothing else (see bot/links.go).
    imgur: props.posts.map((p) => p.mirror?.trim()).filter((u): u is string => !!u),
    preview: short('preview'),
    hd: short('hd'),
    sd: short('sd'),
  }
})

/**
 * The preview's format, which is what the post menu calls it too. Stills are
 * AVIF and gifs mostly WebP, so a mixed selection names both.
 */
const previewLabel = computed(() => {
  const formats = new Set(
    links.value.preview.map((u) => /\.(webp|avif)$/i.exec(u)?.[1]?.toLowerCase()),
  )
  if (formats.size === 1 && formats.has('avif')) return 'AVIF'
  if (formats.has('avif') && formats.has('webp')) return 'WebP / AVIF'
  return 'WebP'
})

/**
 * In the bar rather than under More: copying links is most of what a
 * selection is for. Every kind is listed with its count, and a kind none of
 * the selection has is disabled rather than hidden, so it's clear it exists.
 */
const copyItems = computed<DropdownMenuItem[]>(() =>
  [
    { key: 'imgur', label: 'Imgur', icon: 'i-simple-icons-imgur', toast: 'Imgur' },
    {
      key: 'preview',
      label: previewLabel.value,
      icon: 'i-simple-icons-discord',
      toast: previewLabel.value,
    },
    { key: 'hd', label: 'HD', icon: 'i-lucide-copy', toast: 'HD' },
    { key: 'sd', label: 'SD', icon: 'i-lucide-copy', toast: 'SD' },
  ].map(({ key, label, icon, toast }) => {
    const urls = links.value[key as keyof typeof links.value]
    return {
      label: `${label} (${urls.length})`,
      icon,
      disabled: urls.length === 0,
      onSelect: () => copyLinks(urls, toast),
    }
  }),
)

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
  <UDropdownMenu :items="copyItems" :content="{ side: 'top', align: 'end' }">
    <UButton icon="i-lucide-copy" label="Copy" size="xs" color="neutral" variant="outline" />
  </UDropdownMenu>
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
