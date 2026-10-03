<script setup lang="ts">
import type { SetsItem, SetsUnifiedItem } from '~/types/appTypes'
import { computed, ref } from 'vue'

/**
 * Merge several sets into one. Admin only.
 *
 * Named to stay clear of DialogUploadSetMatch (formerly DialogMergeSet), which is
 * upload-time set *matching* — it picks an existing set to upload into and merges
 * nothing.
 *
 * Two steps on purpose. Picking the survivor is a real choice, and the confirm
 * screen is where the irreversible part gets stated: the other sets are deleted,
 * and their titles and dates go with them.
 */
type AnySet = SetsItem | SetsUnifiedItem

const props = defineProps<{
  isVisible: boolean
  sets: AnySet[]
}>()

const emit = defineEmits<{
  'update:isVisible': [value: boolean]
  merged: []
}>()

const toast = useToast()
const { isMerging, mergeSets } = useMergeSets()

const targetId = ref<string | null>(props.sets[0]?.id ?? null)
const isConfirming = ref(false)

const target = computed(() => props.sets.find((s) => s.id === targetId.value) ?? null)
const sources = computed(() => props.sets.filter((s) => s.id !== targetId.value))

function clipCount(set: AnySet) {
  return ((set.expand as any)?.contents_via_set ?? []).length
}

const totalClips = computed(() => props.sets.reduce((n, s) => n + clipCount(s), 0))

/** Uploaders across every set, which the merge unions onto the target. */
const mergedUploaders = computed(() => {
  const byId = new Map<string, any>()
  for (const set of props.sets) {
    for (const u of [(set.expand as any)?.uploader ?? []].flat()) {
      if (u?.id) byId.set(u.id, u)
    }
  }
  return [...byId.values()]
})

function selectTarget(id: string) {
  targetId.value = id
}

async function commit() {
  if (!targetId.value || sources.value.length === 0) return
  try {
    const result = await mergeSets(
      targetId.value,
      sources.value.map((s) => s.id),
    )
    toast.add({
      title: 'Merged',
      description: `${result.moved} clip${result.moved === 1 ? '' : 's'} moved, ${result.deleted.length} set${result.deleted.length === 1 ? '' : 's'} removed.`,
      color: 'success',
      duration: 4000,
    })
    emit('merged')
    close()
  } catch (error: any) {
    // 409 is the backend's count guard: a source gained a clip mid-merge and
    // nothing was changed. Worth saying so rather than a generic failure.
    const status = error?.status
    toast.add({
      title: status === 409 ? 'Nothing was changed' : 'Merge failed',
      description: error?.response?.message ?? 'Could not merge these sets.',
      color: status === 409 ? 'warning' : 'error',
      duration: 5000,
    })
    isConfirming.value = false
  }
}

function close() {
  emit('update:isVisible', false)
}

function onBack() {
  if (isConfirming.value) isConfirming.value = false
  else close()
}

function onPrimary() {
  if (isConfirming.value) void commit()
  else isConfirming.value = true
}
</script>

<template>
  <UModal
    :open="isVisible"
    :title="isConfirming ? 'Confirm merge' : 'Merge sets'"
    :ui="{ content: 'sm:max-w-lg' }"
    @update:open="emit('update:isVisible', $event)"
  >
    <template #body>
      <!-- Pick the survivor -->
      <div v-if="!isConfirming">
        <p class="text-xs text-night-500 mb-3">
          Choose which set to keep. The others' clips move into it and the empty sets are deleted.
        </p>

        <div class="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
          <div
            v-for="set in sets"
            :key="set.id"
            class="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200"
            :class="
              targetId === set.id
                ? 'border-pink-500/60 bg-pink-500/10'
                : 'border-white/8 bg-white/3 hover:border-pink-500/30 hover:bg-white/5'
            "
            @click="selectTarget(set.id)"
          >
            <div
              class="mt-0.5 w-4 h-4 shrink-0 rounded-full border-2 transition-all duration-200 flex items-center justify-center"
              :class="targetId === set.id ? 'border-pink-400 bg-pink-400' : 'border-white/25'"
            >
              <div v-if="targetId === set.id" class="w-1.5 h-1.5 rounded-full bg-white" />
            </div>

            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-night-100 truncate">
                {{ set.title || set.id }}
              </p>
              <div class="flex flex-wrap gap-1 mt-1.5">
                <UBadge
                  v-for="idol in (set.expand as any)?.idol ?? []"
                  :key="idol.id"
                  icon="i-lucide-star"
                  color="warning"
                  variant="soft"
                  :label="idol.name"
                  class="select-none text-xs!"
                />
                <UBadge
                  v-for="group in (set.expand as any)?.group ?? []"
                  :key="group.id"
                  icon="i-lucide-at-sign"
                  color="info"
                  variant="soft"
                  :label="group.name"
                  class="select-none text-xs!"
                />
              </div>
              <p class="text-xs text-night-500 mt-1.5 font-mono">
                {{ clipCount(set) }} item{{ clipCount(set) === 1 ? '' : 's' }} ·
                {{ new Date(set.created).toLocaleDateString() }}
                <span v-if="targetId === set.id" class="text-pink-300"> · keeping this one</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Confirm -->
      <div v-else class="flex flex-col gap-3 text-sm">
        <p>
          Merging <strong>{{ sets.length }}</strong> sets ({{ totalClips }} clips) into
          <strong>«{{ target?.title || target?.id }}»</strong>.
        </p>

        <div class="flex flex-col gap-1 text-xs">
          <p class="text-night-400">These sets will be deleted:</p>
          <p v-for="set in sources" :key="set.id" class="text-night-200 truncate">
            — {{ set.title || set.id }}
          </p>
        </div>

        <div class="text-xs text-night-400">
          <p>
            Kept: the target's title, idols, groups and date. The other sets' titles and dates are
            discarded.
          </p>
        </div>

        <div v-if="mergedUploaders.length" class="flex flex-col gap-1">
          <p class="text-xs text-night-400">Uploaders merged onto the target:</p>
          <div class="flex flex-wrap gap-1">
            <UBadge
              v-for="u in mergedUploaders"
              :key="u.id"
              :label="u.name"
              color="neutral"
              variant="soft"
              class="text-xs!"
            />
          </div>
        </div>

        <p class="text-xs text-error-400">This cannot be undone.</p>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-3 w-full">
        <UButton
          :label="isConfirming ? 'Back' : 'Cancel'"
          color="neutral"
          block
          :disabled="isMerging"
          @click="onBack"
        />
        <UButton
          :label="isConfirming ? 'Merge' : 'Continue'"
          color="success"
          block
          :disabled="!targetId || sources.length === 0"
          :loading="isMerging"
          @click="onPrimary"
        />
      </div>
    </template>
  </UModal>
</template>
