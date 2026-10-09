<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ContentsItem, SetsItem, SetsUnifiedItem } from '~/types/appTypes'
import { computed, ref } from 'vue'

/**
 * The hidden moderation menu: hold ADMIN_MENU_KEY and right-click any card.
 *
 * A separate menu rather than more entries on ContentActionsMenu, for three
 * reasons. That menu is already eleven entries on a rich record and is the one
 * every visitor uses; these actions are destructive and want no company; and an
 * admin browsing normally should not have Delete one row away from Download.
 *
 * Whichever of the content and the set the caller has is what gets offered — a
 * card in a set listing has both, the single page has a content and maybe its
 * set, a stacked set card has only the set. Everything is gated on `isAdmin`
 * here as well as by the caller, and the collection rules are the real gate.
 */
const props = defineProps<{
  content?: ContentsItem | null
  /** The set record, when the caller already holds one (grouped and set cards). */
  set?: SetsItem | SetsUnifiedItem | null
  /** The set's id, when that is all the caller has (a content card knows `content.set`). */
  setId?: string | null
}>()

const emit = defineEmits<{
  /** A record was edited or moved. The listing should refetch. */
  changed: []
  /** The content was deleted. It is gone from the server. */
  contentDeleted: []
  /** The set was deleted, along with every clip in it. */
  setDeleted: []
}>()

const pb = usePocketBase()
const toast = useToast()
const confirm = useConfirm()
const authStore = useAuthStore()
const { baseUrl } = useRuntimeConfig().public

const { open, reference, show } = useContextMenuAnchor()

defineExpose({ show })

const isContentEditVisible = ref(false)
const isSetEditVisible = ref(false)

/** Filled by ensureSet when the caller only handed over an id. */
const fetchedSet = ref<any>(null)

const resolvedSet = computed<any>(() => props.set ?? fetchedSet.value)
const resolvedSetId = computed(() => props.set?.id ?? props.setId ?? null)

/**
 * The full set record, fetched if the caller only knew its id.
 *
 * A content card carries `content.set` and nothing else, but editing a set needs
 * its idols expanded and deleting one needs its child count — so the fetch is
 * deferred to the moment a set action is actually chosen, rather than paid for
 * on every card that mounts this menu.
 */
async function ensureSet(): Promise<any | null> {
  if (resolvedSet.value) return resolvedSet.value
  const id = resolvedSetId.value
  if (!id) return null
  try {
    fetchedSet.value = await pb.collection('contents_sets').getOne(id, {
      expand: 'idol,group,uploader,uploader.user,contents_via_set',
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

/**
 * The record's page in the PocketBase admin UI.
 *
 * `baseUrl` is the API origin, which is also where the admin UI is served from,
 * so this needs no config entry of its own.
 */
function openInPocketBase(collection: string, id: string) {
  const origin = String(baseUrl).replace(/\/+$/, '')
  window.open(`${origin}/_/#/collections?collection=${collection}&recordId=${id}`, '_blank')
}

async function openSetEdit() {
  if (await ensureSet()) isSetEditVisible.value = true
}

async function deleteContent() {
  const c = props.content
  if (!c) return
  if (
    !(await confirm({
      title: 'Delete this post?',
      message: `"${c.title || c.id}" and its files will be deleted for good.`,
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

async function deleteSet() {
  const s = await ensureSet()
  if (!s) return
  const count = setContents(s).length
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
    await pb.collection('contents_sets').delete(s.id)
    toast.add({ title: 'Set deleted', color: 'success', duration: 2000 })
    emit('setDeleted')
  } catch (error: any) {
    report(error, "Couldn't delete set")
  }
}

/**
 * Pull one clip out of its set without deleting either.
 *
 * The recurring moderation job the site had no answer for: the bot folds
 * follow-up messages into the pinged set, so a mis-grouped clip could only be
 * fixed by deleting it and uploading it again. Clearing `set` leaves it as a
 * standalone item, and re-filing it later is an ordinary edit.
 */
async function detachFromSet() {
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

const items = computed<DropdownMenuItem[][]>(() => {
  if (!authStore.isAdmin) return []

  const contentId = props.content?.id ?? null
  const setId = resolvedSetId.value

  const edit: DropdownMenuItem[] = []
  if (contentId) {
    edit.push({
      label: 'Edit post',
      icon: 'i-lucide-pencil',
      onSelect: () => {
        isContentEditVisible.value = true
      },
    })
  }
  if (setId) {
    edit.push({
      label: 'Edit set',
      icon: 'i-lucide-pencil-ruler',
      onSelect: () => openSetEdit(),
    })
  }

  const inspect: DropdownMenuItem[] = []
  if (contentId) {
    inspect.push(
      {
        label: 'Copy post ID',
        icon: 'i-lucide-hash',
        onSelect: () => copyText(contentId, 'Post ID'),
      },
      {
        label: 'Open post in PocketBase',
        icon: 'i-lucide-database',
        onSelect: () => openInPocketBase('contents', contentId),
      },
    )
  }
  if (setId) {
    inspect.push(
      {
        label: 'Copy set ID',
        icon: 'i-lucide-hash',
        onSelect: () => copyText(setId, 'Set ID'),
      },
      {
        label: 'Open set in PocketBase',
        icon: 'i-lucide-database',
        onSelect: () => openInPocketBase('contents_sets', setId),
      },
    )
  }

  const destructive: DropdownMenuItem[] = []
  // Detach leads the group but is not coloured with it: re-filing the clip is an
  // ordinary edit away, unlike the two deletes below it.
  if (props.content?.set) {
    destructive.push({
      label: 'Remove from set',
      icon: 'i-lucide-unlink',
      onSelect: () => detachFromSet(),
    })
  }
  if (contentId) {
    destructive.push({
      label: 'Delete post',
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect: () => deleteContent(),
    })
  }
  if (setId) {
    destructive.push({
      label: 'Delete set',
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect: () => deleteSet(),
    })
  }

  // Drop empties so a surface offering only one category leaves no stray
  // separator — the rule ContentActionsMenu already follows.
  const groups = [edit, inspect, destructive].filter((group) => group.length > 0)
  if (groups.length === 0) return []

  // One header, on the first group only. ContentActionsMenu deliberately has
  // none (height), but this menu opens on a hidden gesture and would otherwise
  // read as the normal menu with unfamiliar entries in it.
  groups[0]!.unshift({ type: 'label', label: 'Admin' })
  return groups
})
</script>

<template>
  <UDropdownMenu
    v-model:open="open"
    :items="items"
    :modal="false"
    :content="{ reference, side: 'bottom', align: 'start', sideOffset: 2 }"
  />

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
</template>
