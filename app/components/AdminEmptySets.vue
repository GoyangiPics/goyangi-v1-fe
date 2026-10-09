<script setup lang="ts">
import type { SetsUnifiedItem } from '~/types/appTypes'
import { computed, onMounted, ref } from 'vue'

/**
 * Sets with no posts in them: left behind when every post was deleted or moved
 * out, or when an upload made the set and then failed. They show up as blank
 * cards on /sets.
 *
 * PocketBase has no cheap "back-relation is empty" filter we can rely on, so
 * this loads the newest sets with their posts expanded (ids only) and keeps the
 * ones that came back empty. Bounded to SCAN sets, older than an hour so an
 * upload still filling its set isn't caught mid-way.
 */
const SCAN = 200
const MIN_AGE_MS = 60 * 60_000

const pb = usePocketBase()
const confirm = useConfirm()
const toast = useToast()
const { run } = useBulkAction()

const sets = ref<SetsUnifiedItem[]>([])
const isLoading = ref(true)

async function load() {
  isLoading.value = true
  try {
    const before = new Date(Date.now() - MIN_AGE_MS)
    const page = await pb.collection('contents_sets').getList<SetsUnifiedItem>(1, SCAN, {
      filter: pb.filter('created < {:before}', { before }),
      sort: '-created',
      expand: 'uploader,contents_via_set',
      fields: 'id,title,created,expand.uploader.name,expand.contents_via_set.id',
      requestKey: 'admin_empty_sets',
    })
    sets.value = page.items.filter((s) => setContents(s).length === 0)
  } catch (e: any) {
    if (!e?.isAbort) console.error('Failed to load empty sets:', e)
  } finally {
    isLoading.value = false
  }
}

const selection = useRowSelection(() => sets.value, {
  keyOf: (set: SetsUnifiedItem) => set.id,
  linksOf: () => [],
})

function uploaderNames(set: SetsUnifiedItem) {
  return (set.expand?.uploader ?? []).map((u) => u.name).join(', ')
}

function dropSets(ids: string[]) {
  const gone = new Set(ids)
  sets.value = sets.value.filter((s) => !gone.has(s.id))
  selection.selectedKeys.value = new Set(
    [...selection.selectedKeys.value].filter((k) => !gone.has(k)),
  )
}

async function remove(set: SetsUnifiedItem) {
  try {
    await pb.collection('contents_sets').delete(set.id, { requestKey: null })
    dropSets([set.id])
    toast.add({ title: 'Set deleted', color: 'success', duration: 2000 })
  } catch (error: any) {
    toast.add({
      title: "Couldn't delete set",
      description: pbErrorDetail(error, 'Try again.'),
      color: 'error',
      duration: 4000,
    })
  }
}

const selectedSets = computed(() => sets.value.filter(selection.isSelected))

async function deleteSelected() {
  const items = selectedSets.value
  const ok = await confirm({
    title: `Delete ${items.length} empty set${items.length === 1 ? '' : 's'}?`,
    message: 'They have no posts, so nothing else is deleted.',
    icon: 'i-lucide-trash-2',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    color: 'error',
  })
  if (!ok) return
  const result = await run({
    items,
    action: (s) => pb.collection('contents_sets').delete(s.id, { requestKey: null }),
    progress: 'Deleting sets…',
    success: (n) => `Deleted ${n} set${n === 1 ? '' : 's'}`,
    failure: "Couldn't delete sets",
  })
  dropSets(result.done.map((s) => s.id))
}

onMounted(load)
</script>

<template>
  <div>
    <div class="flex items-center gap-2 mb-3">
      <h2 class="text-sm font-semibold text-night-100">Empty sets</h2>
      <span class="text-xs text-night-500">From the newest {{ SCAN }} sets.</span>
      <UCheckbox
        v-if="sets.length"
        :model-value="selection.allSelected.value"
        :indeterminate="selection.someSelected.value"
        label="Select all"
        size="sm"
        class="ml-auto"
        @update:model-value="selection.allSelected.value = !!$event"
      />
    </div>

    <div v-if="isLoading" class="flex justify-center items-center my-8">
      <LoadingSpinner />
    </div>

    <p v-else-if="!sets.length" class="text-sm text-night-400">No empty sets.</p>

    <template v-else>
      <SelectionActionBar :selected-count="selection.selectedCount.value" @clear="selection.clear">
        <template #actions>
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
          v-for="set in sets"
          :key="set.id"
          class="flex items-center gap-3 p-2.5 rounded-xl border transition-colors"
          :class="
            selection.isSelected(set)
              ? 'border-primary/40 bg-primary/5'
              : 'border-white/8 bg-white/2 hover:bg-white/4'
          "
        >
          <UCheckbox
            :model-value="selection.isSelected(set)"
            :aria-label="`Select ${set.title || set.id}`"
            @update:model-value="selection.toggle(set)"
          />
          <div class="min-w-0 flex-1">
            <NuxtLink
              :to="`/set/${set.id}`"
              class="text-sm font-medium truncate block hover:underline"
            >
              {{ set.title || 'Untitled set' }}
            </NuxtLink>
            <div class="flex items-center gap-1.5 mt-0.5 text-xs text-night-500">
              <span>{{ uploaderNames(set) || 'no uploader' }}</span>
              <span class="font-mono">· {{ formatShortDate(set.created) }}</span>
            </div>
          </div>
          <!-- No confirm: an empty set has nothing in it to lose. -->
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            color="error"
            variant="ghost"
            aria-label="Delete set"
            @click="remove(set)"
          />
        </div>
      </div>
    </template>
  </div>
</template>
