<script setup lang="ts">
import type { Uploader } from '~/types/appTypes'
import { computed, onMounted, ref } from 'vue'

/**
 * Per-uploader stop switch for the Discord bot. Blocking an uploader stops new
 * imports for them; nothing already imported is touched.
 *
 * Separate from `skipDiscordImport`, which is the uploader's own opt-out on
 * their profile. This one is ours: admins can set it on anyone, and it's the
 * only field the backend lets an admin change on someone else's uploader.
 */
type Row = Pick<Uploader, 'id' | 'name' | 'user' | 'blockIngest'>

const pb = usePocketBase()
const toast = useToast()

const uploaders = ref<Row[]>([])
const isLoading = ref(true)
const searchTerm = ref('')

async function load() {
  isLoading.value = true
  try {
    uploaders.value = await pb.collection('uploaders').getFullList<Row>({
      sort: 'name',
      fields: 'id,name,user,blockIngest',
      requestKey: 'admin_uploaders',
    })
  } catch (e: any) {
    if (!e?.isAbort) console.error('Failed to load uploaders:', e)
  } finally {
    isLoading.value = false
  }
}

const filtered = computed(() => {
  const t = searchTerm.value.trim().toLowerCase()
  if (!t) return uploaders.value
  return uploaders.value.filter((u) => (u.name ?? '').toLowerCase().includes(t))
})

const blockedCount = computed(() => uploaders.value.filter((u) => u.blockIngest).length)

/** Flips the switch first and puts it back if the save fails. */
async function setBlocked(row: Row, blocked: boolean) {
  row.blockIngest = blocked
  try {
    await pb.collection('uploaders').update(row.id, { blockIngest: blocked }, { requestKey: null })
    toast.add({
      title: blocked
        ? `Discord import blocked for ${row.name}`
        : `Discord import on for ${row.name}`,
      color: 'success',
      duration: 2000,
    })
  } catch (error: any) {
    row.blockIngest = !blocked
    toast.add({
      title: "Couldn't save",
      description: pbErrorDetail(error, 'Try again.'),
      color: 'error',
      duration: 4000,
    })
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="flex items-center gap-2 mb-4">
      <div
        class="filter-input-wrapper relative flex-1 flex items-center gap-1.5 pl-10 pr-2 py-1 min-h-8"
      >
        <UIcon
          name="i-lucide-search"
          class="absolute top-1/2 -translate-y-1/2 left-3 text-night-400 dark:text-night-600"
        />
        <input
          v-model="searchTerm"
          type="text"
          placeholder="Search uploaders…"
          class="filter-input flex-1 bg-transparent outline-none border-0 text-sm py-1"
        />
      </div>
      <!-- Merging lives on /uploaders, where every profile shows its post count. -->
      <UButton
        icon="i-lucide-merge"
        label="Merge duplicates"
        size="sm"
        color="neutral"
        variant="outline"
        to="/uploaders"
      />
    </div>

    <p v-if="blockedCount" class="text-xs text-night-500 mb-3">
      {{ blockedCount }} blocked from Discord import.
    </p>

    <div v-if="isLoading" class="flex justify-center items-center mt-16">
      <LoadingSpinner />
    </div>

    <div v-else-if="!filtered.length" class="flex justify-center items-center mt-16">
      <h1 class="text-2xl text-night-400">No uploaders found.</h1>
    </div>

    <div v-else class="flex flex-col gap-2">
      <div
        v-for="row in filtered"
        :key="row.id"
        class="flex items-center gap-3 p-2.5 rounded-xl border transition-colors"
        :class="row.blockIngest ? 'border-red-500/30 bg-red-500/5' : 'border-white/8 bg-white/2'"
      >
        <div class="min-w-0 flex-1 flex items-center gap-2">
          <NuxtLink
            :to="`/uploaders/${encodeURIComponent(row.name ?? '')}`"
            class="text-sm font-medium truncate hover:underline"
          >
            {{ row.name || 'Unnamed' }}
          </NuxtLink>
          <UBadge
            v-if="!row.user"
            icon="i-lucide-unlink"
            label="No account"
            color="neutral"
            variant="soft"
            class="text-xs! shrink-0"
          />
        </div>
        <USwitch
          :model-value="!!row.blockIngest"
          label="Block Discord import"
          size="sm"
          @update:model-value="setBlocked(row, $event)"
        />
      </div>
    </div>
  </div>
</template>
