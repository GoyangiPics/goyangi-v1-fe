<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import { computed, ref, watch } from 'vue'

/**
 * Move one or more posts into a set — an existing one of yours (admins: any),
 * or a new one made from the posts themselves.
 *
 * Moving out of a set is "Remove from set"; this is for putting posts where
 * they belong. The backend only lets owners move posts into sets they co-own,
 * so that's all this offers them. A set the move empties is deleted server-side.
 */
const props = defineProps<{
  isVisible: boolean
  posts: ContentsItem[]
}>()

const emit = defineEmits<{
  'update:isVisible': [value: boolean]
  moved: [movedIds: string[]]
}>()

const pb = usePocketBase()
const authStore = useAuthStore()
const { run } = useBulkAction()

const search = ref('')
const sets = ref<any[]>([])
const isLoading = ref(false)
const isMoving = ref(false)
const selected = ref<string | null>(null)
const NEW = '__new__'

const first = computed(() => props.posts[0])
const currentSets = computed(() => new Set(props.posts.map((p) => p.set).filter(Boolean)))

const newTitle = ref('')
watch(
  () => props.isVisible,
  (open) => {
    if (!open) return
    const p = first.value
    const day = p?.date ? new Date(p.date) : new Date()
    newTitle.value = `${formatYYMMDD(day)} ${p?.title ?? ''}`.trim()
    selected.value = null
    search.value = ''
    loadSets()
  },
  { immediate: true },
)

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(loadSets, 250)
})

async function loadSets() {
  isLoading.value = true
  try {
    const parts: string[] = []
    if (!authStore.isAdmin)
      parts.push(pb.filter('uploader.user ?= {:me}', { me: authStore.user?.id }))
    if (search.value.trim()) parts.push(pb.filter('title ~ {:q}', { q: search.value.trim() }))
    const page = await pb.collection('contents_sets').getList(1, 30, {
      filter: parts.join(' && '),
      sort: '-created',
      fields: 'id,title,date,created',
      requestKey: null,
    })
    sets.value = page.items.filter((s: any) => !currentSets.value.has(s.id))
  } catch {
    sets.value = []
  } finally {
    isLoading.value = false
  }
}

function unionIds(field: 'idol' | 'group'): string[] {
  return [...new Set(props.posts.flatMap((p) => ((p as any)[field] ?? []) as string[]))]
}

async function createSet(): Promise<string | null> {
  const p = first.value
  try {
    const record = await pb.collection('contents_sets').create({
      title: newTitle.value.trim() || 'Untitled',
      idol: unionIds('idol'),
      group: unionIds('group'),
      date: p?.date || new Date().toISOString(),
      // The creator names only themselves; once the posts are in, the backend
      // derives the real list from them.
      uploader: authStore.uploader ? [authStore.uploader.id] : [],
    })
    return record.id
  } catch (error: any) {
    useToast().add({
      title: "Couldn't create set",
      description: pbErrorDetail(error, 'Try again.'),
      color: 'error',
      duration: 4000,
    })
    return null
  }
}

async function move() {
  if (!selected.value) return
  isMoving.value = true
  try {
    const target = selected.value === NEW ? await createSet() : selected.value
    if (!target) return
    const result = await run({
      items: props.posts,
      action: (post) =>
        pb.collection('contents').update(post.id, { set: target }, { requestKey: null }),
      progress: 'Moving posts…',
      success: (n) => `Moved ${n} post${n === 1 ? '' : 's'}`,
      failure: "Couldn't move posts",
    })
    emit(
      'moved',
      result.done.map((p) => p.id),
    )
    if (result.failed.length === 0) emit('update:isVisible', false)
  } finally {
    isMoving.value = false
  }
}

const title = computed(() =>
  props.posts.length === 1 ? 'Move to set' : `Move ${props.posts.length} posts to a set`,
)
</script>

<template>
  <UModal
    :open="isVisible"
    :title="title"
    :ui="{ content: 'sm:max-w-md' }"
    @update:open="emit('update:isVisible', $event)"
  >
    <template #body>
      <div class="flex flex-col gap-3">
        <UInput v-model="search" icon="i-lucide-search" placeholder="Search sets…" autofocus />

        <div class="flex flex-col gap-1 max-h-72 overflow-y-auto -mx-1 px-1">
          <button
            type="button"
            class="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors"
            :class="selected === NEW ? 'bg-pink-500/20 ring-1 ring-pink-400' : 'hover:bg-night-800'"
            @click="selected = NEW"
          >
            <UIcon name="i-lucide-plus" class="shrink-0 text-pink-300" />
            <span class="font-medium">New set</span>
          </button>
          <UInput
            v-if="selected === NEW"
            v-model="newTitle"
            size="sm"
            placeholder="Set title"
            class="mb-1"
          />

          <div v-if="isLoading" class="flex justify-center py-4">
            <LoadingSpinner />
          </div>
          <p v-else-if="sets.length === 0" class="text-xs text-night-500 px-2 py-3">
            {{ search ? 'No sets match.' : 'No other sets yet.' }}
          </p>
          <button
            v-for="s in sets"
            v-else
            :key="s.id"
            type="button"
            class="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors"
            :class="
              selected === s.id ? 'bg-pink-500/20 ring-1 ring-pink-400' : 'hover:bg-night-800'
            "
            @click="selected = s.id"
          >
            <UIcon name="i-lucide-film" class="shrink-0 text-night-400" />
            <span class="flex-1 min-w-0 truncate">{{ s.title || 'Untitled' }}</span>
            <span class="shrink-0 text-xs text-night-500 font-mono">
              {{ formatShortDate(s.date || s.created) }}
            </span>
          </button>
        </div>

        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="emit('update:isVisible', false)"
          />
          <UButton
            label="Move"
            icon="i-lucide-folder-input"
            :disabled="!selected"
            :loading="isMoving"
            @click="move"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
