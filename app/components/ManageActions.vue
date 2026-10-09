<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ContentsItem, SetsItem, SetsUnifiedItem } from '~/types/appTypes'
import { computed, ref } from 'vue'
import { setDeleteMode } from '~/utils/ownership'

/**
 * Edit, move, delete and retry for a post and/or its set — offered to the
 * owner and to admins, wherever the post or set is shown.
 *
 * Renders only its dialogs. Menus (ContentActionsMenu, SetActionsMenu) append
 * `groups` to their own items, and pages call the exposed actions from visible
 * buttons, so every surface runs the same code. This replaced a separate admin
 * menu that opened only with a key held during right-click — invisible to
 * owners, undiscoverable, and impossible on a phone.
 *
 * What's offered follows utils/ownership; the backend rules are the real gate.
 */
const props = defineProps<{
  content?: ContentsItem | null
  /** The set record, when the caller has one (set cards, grouped cards). */
  set?: SetsItem | SetsUnifiedItem | null
  /** The set's id, when that's all the caller knows (a post card has `content.set`). */
  setId?: string | null
}>()

const emit = defineEmits<{
  /** Something was edited or moved; the listing should refetch. */
  changed: []
  /** The post is gone. */
  contentDeleted: []
  /** The set is gone, with its posts. */
  setDeleted: []
}>()

const pb = usePocketBase()
const toast = useToast()
const confirm = useConfirm()
const { viewer, canManagePost, canManageSet, setPostCounts } = useOwnership()
const { run } = useBulkAction()
const { baseUrl } = useRuntimeConfig().public

const isContentEditVisible = ref(false)
const isSetEditVisible = ref(false)
const isMoveVisible = ref(false)

const fetchedSet = ref<any>(null)
const resolvedSet = computed<any>(() => props.set ?? fetchedSet.value)
const resolvedSetId = computed(() => props.set?.id ?? props.setId ?? props.content?.set ?? null)

const canPost = computed(() => canManagePost(props.content))
/**
 * A set record answers for itself. A post card only knows the set's id — but
 * set uploaders are derived from their posts, so owning a post in it means
 * co-owning the set.
 */
const canSet = computed(() =>
  props.set ? canManageSet(props.set as any) : !!resolvedSetId.value && canPost.value,
)

/** Fetched on demand: editing needs idols expanded, and only then is it worth a request. */
async function ensureSet(): Promise<any | null> {
  if (resolvedSet.value) return resolvedSet.value
  const id = resolvedSetId.value
  if (!id) return null
  try {
    fetchedSet.value = await pb.collection('contents_sets').getOne(id, {
      expand: 'idol,group,uploader,uploader.user',
      requestKey: null,
    })
    return fetchedSet.value
  } catch (error: any) {
    report(error, "Couldn't load set")
    return null
  }
}

function report(error: any, title: string) {
  toast.add({
    title,
    description: pbErrorDetail(error, 'Try again.'),
    color: 'error',
    duration: 4000,
  })
}

async function copyText(value: string, what: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ title: `${what} copied`, color: 'info', duration: 1000 })
  } catch {
    toast.add({ title: "Couldn't copy", color: 'error', duration: 3000 })
  }
}

/** The record in the PocketBase admin UI, served from the API origin. */
function openInPocketBase(collection: string, id: string) {
  const origin = String(baseUrl).replace(/\/+$/, '')
  window.open(`${origin}/_/#/collections?collection=${collection}&recordId=${id}`, '_blank')
}

// ─── Post ────────────────────────────────────────────────────────────────────

function editPost() {
  if (props.content) isContentEditVisible.value = true
}

function movePost() {
  if (props.content) isMoveVisible.value = true
}

async function removeFromSet() {
  const c = props.content
  if (!c?.set) return
  if (
    !(await confirm({
      title: 'Remove from set?',
      message: "The post itself won't be deleted.",
      icon: 'i-lucide-unlink',
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      color: 'warning',
    }))
  ) {
    return
  }
  try {
    await pb.collection('contents').update(c.id, { set: '' })
    toast.add({ title: 'Removed from set', color: 'success', duration: 2000 })
    emit('changed')
  } catch (error: any) {
    report(error, "Couldn't remove from set")
  }
}

async function deletePost() {
  const c = props.content
  if (!c) return
  if (
    !(await confirm({
      title: 'Delete this post?',
      message: "This can't be undone.",
      icon: 'i-lucide-trash-2',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      color: 'error',
    }))
  ) {
    return
  }
  try {
    await pb.collection('contents').delete(c.id)
    toast.add({ title: 'Post deleted', color: 'success', duration: 2000 })
    emit('contentDeleted')
  } catch (error: any) {
    report(error, "Couldn't delete post")
  }
}

/** Re-run processing for a post that failed or was interrupted. */
async function retryPost() {
  const c = props.content
  if (!c) return
  try {
    await pb.send(`/api/contents/${c.id}/reprocess`, { method: 'POST' })
    toast.add({
      title: 'Processing again',
      description: 'It should be ready in a few minutes.',
      color: 'success',
      duration: 3000,
    })
    emit('changed')
  } catch (error: any) {
    report(error, "Couldn't retry")
  }
}

// ─── Set ─────────────────────────────────────────────────────────────────────

async function editSet() {
  if (await ensureSet()) isSetEditVisible.value = true
}

/**
 * Deletes the set when every post in it is yours (or you're an admin).
 * In a set shared with other uploaders it deletes only your posts instead —
 * theirs aren't yours to delete, and the backend refuses the set.
 */
async function deleteSet() {
  const id = resolvedSetId.value
  if (!id) return
  let counts: { total: number; mine: number }
  try {
    counts = await setPostCounts(id)
  } catch (error: any) {
    report(error, "Couldn't load set")
    return
  }
  const mode = setDeleteMode(counts, viewer.value)

  if (mode === 'none') {
    toast.add({ title: 'None of these posts are yours', color: 'warning', duration: 3000 })
    return
  }

  if (mode === 'set') {
    const ok = await confirm({
      title: 'Delete this set?',
      message: counts.total
        ? `Its ${counts.total} post${counts.total === 1 ? '' : 's'} will be deleted too. This can't be undone.`
        : "This can't be undone.",
      icon: 'i-lucide-trash-2',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      color: 'error',
    })
    if (!ok) return
    try {
      await pb.collection('contents_sets').delete(id)
      toast.add({ title: 'Set deleted', color: 'success', duration: 2000 })
      emit('setDeleted')
    } catch (error: any) {
      report(error, "Couldn't delete set")
    }
    return
  }

  const ok = await confirm({
    title: 'Delete your posts in this set?',
    message:
      `Other people have posts here too, so the set stays. ` +
      `Your ${counts.mine} post${counts.mine === 1 ? '' : 's'} will be deleted. This can't be undone.`,
    icon: 'i-lucide-trash-2',
    confirmLabel: 'Delete my posts',
    cancelLabel: 'Cancel',
    color: 'error',
  })
  if (!ok) return
  try {
    const mine = await pb.collection('contents').getFullList({
      filter: pb.filter('set = {:id} && uploader = {:up}', { id, up: viewer.value.uploaderId }),
      fields: 'id',
      requestKey: null,
    })
    await run({
      items: mine,
      action: (p) => pb.collection('contents').delete(p.id, { requestKey: null }),
      progress: 'Deleting your posts…',
      success: (n) => `Deleted ${n} post${n === 1 ? '' : 's'}`,
      failure: "Couldn't delete posts",
    })
    emit('changed')
  } catch (error: any) {
    report(error, "Couldn't delete posts")
  }
}

// ─── Menu groups ─────────────────────────────────────────────────────────────

const groups = computed<DropdownMenuItem[][]>(() => {
  const out: DropdownMenuItem[][] = []
  const c = props.content
  const setId = resolvedSetId.value

  if (c && canPost.value) {
    const post: DropdownMenuItem[] = [
      { label: 'Edit post', icon: 'i-lucide-pencil', onSelect: editPost },
      { label: 'Move to set…', icon: 'i-lucide-folder-input', onSelect: movePost },
    ]
    if (c.set)
      post.push({ label: 'Remove from set', icon: 'i-lucide-unlink', onSelect: removeFromSet })
    if (!c.preview)
      post.push({ label: 'Retry processing', icon: 'i-lucide-refresh-cw', onSelect: retryPost })
    post.push({
      label: 'Delete post',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: deletePost,
    })
    out.push(post)
  }

  if (setId && canSet.value) {
    // A set listing more than one uploader is shared: deleting it means
    // deleting your own posts. A post card can't tell yet, so it asks on select.
    const shared = !viewer.value.isAdmin && ((props.set as any)?.uploader?.length ?? 0) > 1
    out.push([
      { label: 'Edit set', icon: 'i-lucide-pencil-ruler', onSelect: editSet },
      {
        label: shared ? 'Delete my posts in set' : 'Delete set',
        icon: 'i-lucide-trash-2',
        color: 'error',
        onSelect: deleteSet,
      },
    ])
  }

  if (viewer.value.isAdmin && (c || setId)) {
    const admin: DropdownMenuItem[] = []
    if (c) {
      admin.push(
        { label: 'Copy post ID', icon: 'i-lucide-hash', onSelect: () => copyText(c.id, 'Post ID') },
        {
          label: 'Open post in PocketBase',
          icon: 'i-lucide-database',
          onSelect: () => openInPocketBase('contents', c.id),
        },
      )
    }
    if (setId) {
      admin.push(
        { label: 'Copy set ID', icon: 'i-lucide-hash', onSelect: () => copyText(setId, 'Set ID') },
        {
          label: 'Open set in PocketBase',
          icon: 'i-lucide-database',
          onSelect: () => openInPocketBase('contents_sets', setId),
        },
      )
    }
    out.push([{ label: 'Admin', icon: 'i-lucide-shield', children: admin }])
  }

  return out
})

defineExpose({
  groups,
  canPost,
  canSet,
  editPost,
  movePost,
  removeFromSet,
  deletePost,
  retryPost,
  editSet,
  deleteSet,
})
</script>

<template>
  <DialogContentEdit
    v-if="isContentEditVisible && content"
    :is-visible="isContentEditVisible"
    :content="content"
    @update:is-visible="isContentEditVisible = $event"
    @saved="emit('changed')"
  />

  <DialogSetEdit
    v-if="isSetEditVisible && resolvedSet"
    :is-visible="isSetEditVisible"
    :set="resolvedSet"
    @update:is-visible="isSetEditVisible = $event"
    @saved="emit('changed')"
  />

  <DialogMoveToSet
    v-if="isMoveVisible && content"
    :is-visible="isMoveVisible"
    :posts="[content]"
    @update:is-visible="isMoveVisible = $event"
    @moved="emit('changed')"
  />
</template>
