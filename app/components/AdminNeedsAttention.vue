<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import { onMounted, ref } from 'vue'

/**
 * Posts with no renditions long after upload: processing failed (encodeError
 * says why) or got interrupted and never came back. Either way nobody can see
 * them, and the uploader may not know.
 *
 * Retry is the same reprocess route the owner gets, without the owner's
 * attempt limit. Empty sets live below: they're the other leftover of a
 * failed or abandoned upload.
 */
const props = defineProps<{
  /** How old a post with no preview has to be before it counts as stuck. */
  stuckMinutes: number
}>()

const emit = defineEmits<{
  /** Stuck or failed posts, for the tab label. */
  count: [n: number]
}>()

/** Enough for any real backlog; the header shows the true total if it's more. */
const PAGE_SIZE = 200

const pb = usePocketBase()
const toast = useToast()
const confirm = useConfirm()
const { run } = useBulkAction()

const posts = ref<ContentsItem[]>([])
const total = ref(0)
const isLoading = ref(true)
const busyIds = ref<Set<string>>(new Set())
/** Retried this session: still no preview, but no longer stuck either. */
const retriedIds = ref<Set<string>>(new Set())

async function load() {
  isLoading.value = true
  try {
    const before = new Date(Date.now() - props.stuckMinutes * 60_000)
    const page = await pb.collection('contents').getList<ContentsItem>(1, PAGE_SIZE, {
      filter: pb.filter("preview = '' && created < {:before}", { before }),
      sort: '-created',
      expand: 'uploader',
      requestKey: 'admin_needs_attention',
    })
    posts.value = page.items
    total.value = page.totalItems
    emit('count', page.totalItems)
  } catch (e: any) {
    if (!e?.isAbort) console.error('Failed to load stuck posts:', e)
  } finally {
    isLoading.value = false
  }
}

const selection = useRowSelection(() => posts.value, {
  keyOf: (post: ContentsItem) => post.id,
  // Nothing to copy: these posts have no renditions.
  linksOf: () => [],
})

function setBusy(id: string, busy: boolean) {
  const next = new Set(busyIds.value)
  if (busy) next.add(id)
  else next.delete(id)
  busyIds.value = next
}

function markRetried(ids: string[]) {
  retriedIds.value = new Set([...retriedIds.value, ...ids])
}

function report(error: any, title: string) {
  toast.add({
    title,
    description: pbErrorDetail(error, 'Try again.'),
    color: 'error',
    duration: 4000,
  })
}

const reprocess = (id: string) =>
  pb.send(`/api/contents/${id}/reprocess`, { method: 'POST', requestKey: null })

async function retry(post: ContentsItem) {
  setBusy(post.id, true)
  try {
    await reprocess(post.id)
    markRetried([post.id])
    toast.add({ title: 'Processing again', color: 'success', duration: 2000 })
  } catch (error: any) {
    report(error, "Couldn't retry")
  } finally {
    setBusy(post.id, false)
  }
}

async function remove(post: ContentsItem) {
  const ok = await confirm({
    title: 'Delete this post?',
    message: "This can't be undone.",
    icon: 'i-lucide-trash-2',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    color: 'error',
  })
  if (!ok) return
  setBusy(post.id, true)
  try {
    await pb.collection('contents').delete(post.id, { requestKey: null })
    dropPosts([post.id])
    toast.add({ title: 'Post deleted', color: 'success', duration: 2000 })
  } catch (error: any) {
    report(error, "Couldn't delete post")
  } finally {
    setBusy(post.id, false)
  }
}

function dropPosts(ids: string[]) {
  const gone = new Set(ids)
  posts.value = posts.value.filter((p) => !gone.has(p.id))
  total.value = Math.max(0, total.value - gone.size)
  emit('count', total.value)
}

// Bulk: whatever succeeded leaves the selection, failures stay selected for
// another go — the same promise useBulkAction's toast makes.
function deselect(ids: string[]) {
  const gone = new Set(ids)
  selection.selectedKeys.value = new Set(
    [...selection.selectedKeys.value].filter((k) => !gone.has(k)),
  )
}

async function retrySelected() {
  const items = posts.value.filter(selection.isSelected)
  const result = await run({
    items,
    action: (p) => reprocess(p.id),
    progress: 'Retrying…',
    success: (n) => `Retrying ${n} post${n === 1 ? '' : 's'}`,
    failure: "Couldn't retry",
  })
  const done = result.done.map((p) => p.id)
  markRetried(done)
  deselect(done)
}

async function deleteSelected() {
  const items = posts.value.filter(selection.isSelected)
  const ok = await confirm({
    title: `Delete ${items.length} post${items.length === 1 ? '' : 's'}?`,
    message: "This can't be undone.",
    icon: 'i-lucide-trash-2',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    color: 'error',
  })
  if (!ok) return
  const result = await run({
    items,
    action: (p) => pb.collection('contents').delete(p.id, { requestKey: null }),
    progress: 'Deleting posts…',
    success: (n) => `Deleted ${n} post${n === 1 ? '' : 's'}`,
    failure: "Couldn't delete posts",
  })
  const done = result.done.map((p) => p.id)
  dropPosts(done)
  deselect(done)
}

onMounted(load)
</script>

<template>
  <div>
    <div class="flex items-center gap-2 mb-3">
      <p class="text-xs text-night-500">
        Posts with no preview {{ stuckMinutes }} minutes after upload.
        <span v-if="total > posts.length"
          >Showing the newest {{ posts.length }} of {{ total }}.</span
        >
      </p>
      <UButton
        icon="i-lucide-refresh-cw"
        label="Refresh"
        size="xs"
        color="neutral"
        variant="ghost"
        class="ml-auto"
        :loading="isLoading"
        @click="load"
      />
    </div>

    <div v-if="isLoading && !posts.length" class="flex justify-center items-center mt-16">
      <LoadingSpinner />
    </div>

    <div v-else-if="!posts.length" class="flex justify-center items-center my-16">
      <h1 class="text-2xl text-night-400">Nothing stuck.</h1>
    </div>

    <template v-else>
      <div class="flex items-center gap-2 mb-3">
        <UCheckbox
          :model-value="selection.allSelected.value"
          :indeterminate="selection.someSelected.value"
          label="Select all"
          size="sm"
          @update:model-value="selection.allSelected.value = !!$event"
        />
      </div>

      <SelectionActionBar :selected-count="selection.selectedCount.value" @clear="selection.clear">
        <template #actions>
          <UButton
            icon="i-lucide-refresh-cw"
            label="Retry selected"
            size="xs"
            color="warning"
            variant="soft"
            @click="retrySelected"
          />
          <UButton
            icon="i-lucide-trash-2"
            label="Delete selected"
            size="xs"
            color="error"
            @click="deleteSelected"
          />
        </template>
      </SelectionActionBar>

      <div class="flex flex-col gap-2">
        <div
          v-for="post in posts"
          :key="post.id"
          class="flex items-center gap-3 p-2.5 rounded-xl border transition-colors"
          :class="
            selection.isSelected(post)
              ? 'border-primary/40 bg-primary/5'
              : 'border-white/8 bg-white/2 hover:bg-white/4'
          "
        >
          <UCheckbox
            :model-value="selection.isSelected(post)"
            :aria-label="`Select ${post.title || post.id}`"
            @update:model-value="selection.toggle(post)"
          />

          <div class="min-w-0 flex-1">
            <NuxtLink
              :to="`/single/${post.id}`"
              class="text-sm font-medium truncate block hover:underline"
            >
              {{ post.title || post.filename || post.id }}
            </NuxtLink>
            <div class="flex items-center gap-1.5 mt-0.5 flex-wrap text-xs text-night-500">
              <UBadge
                v-if="retriedIds.has(post.id)"
                label="Retrying"
                icon="i-lucide-loader-circle"
                color="info"
                variant="soft"
                class="text-xs!"
              />
              <UBadge
                v-else-if="post.encodeError"
                :label="`Failed: ${post.encodeError}`"
                :title="post.encodeError"
                color="error"
                variant="soft"
                class="text-xs! max-w-80 truncate"
              />
              <UBadge v-else label="Stuck" color="warning" variant="soft" class="text-xs!" />
              <span>
                {{ post.encodeAttempts ?? 0 }} attempt{{ post.encodeAttempts === 1 ? '' : 's' }}
              </span>
              <span>· {{ post.expand?.uploader?.name || 'unknown uploader' }}</span>
              <span class="font-mono">· {{ formatShortDate(post.created) }}</span>
            </div>
          </div>

          <UButton
            icon="i-lucide-refresh-cw"
            label="Retry"
            size="xs"
            color="warning"
            variant="soft"
            :loading="busyIds.has(post.id)"
            @click="retry(post)"
          />
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            color="error"
            variant="ghost"
            aria-label="Delete post"
            :disabled="busyIds.has(post.id)"
            @click="remove(post)"
          />
        </div>
      </div>
    </template>

    <AdminEmptySets class="mt-8" />
  </div>
</template>
