<script setup lang="ts">
import type { CollectionsItem, ContentsItem, SetsItem } from '~/types/appTypes'
import { computed, onMounted, ref } from 'vue'

const props = defineProps<{
  isVisible: boolean
  content: SetsItem | CollectionsItem
  isSet: boolean
  columns: number
  randomize: boolean
  loopsPerContent: number
}>()

const emit = defineEmits<{
  'update:isVisible': [boolean]
}>()

const pb = usePocketBase()

const isLoading = ref(true)
const loadError = ref(false)
const allItems = ref<ContentsItem[]>([])
const isPlaying = ref(true)

// ── fetch ──────────────────────────────────────────────────────────────────────

async function fetchAll() {
  isLoading.value = true
  loadError.value = false
  try {
    const filter = props.isSet ? `set="${props.content.id}"` : `collections~"${props.content.id}"`

    const items = await pb.collection('contents').getFullList<ContentsItem>({
      sort: '-created',
      filter,
    })

    if (props.randomize) {
      // Fisher-Yates
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = items[i]!
        items[i] = items[j]!
        items[j] = tmp
      }
    }

    allItems.value = items
  } catch (err) {
    console.error('Slideshow fetch failed:', err)
    loadError.value = true
  } finally {
    isLoading.value = false
  }
}

// ── column groups (round-robin so each column gets roughly equal items) ───────

const columnGroups = computed<ContentsItem[][]>(() => {
  const n = props.columns
  const groups: ContentsItem[][] = Array.from({ length: n }, () => [])
  allItems.value.forEach((item, i) => groups[i % n]!.push(item))
  // drop any empty groups (happens when items < columns)
  return groups.filter((g) => g.length > 0)
})

// ── loop-per-item label ────────────────────────────────────────────────────────

const loopsLabel = computed(() =>
  props.loopsPerContent === 1 ? '1 loop' : `${props.loopsPerContent} loops`,
)

onMounted(fetchAll)
</script>

<template>
  <Teleport to="body">
    <Transition name="ss-overlay">
      <div
        v-if="isVisible"
        class="fixed inset-0 z-[9999] bg-black flex flex-col"
        style="overscroll-behavior: none"
      >
        <!-- ── header ─────────────────────────────────────────────────────── -->
        <div class="flex items-center gap-3 px-4 py-2.5 border-b border-white/10 shrink-0">
          <!-- play / pause -->
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            @click="isPlaying = !isPlaying"
          >
            <UIcon :name="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'" />
          </button>

          <!-- info -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-white truncate">
              {{ content.title }}
            </p>
            <p class="text-xs text-white/40 truncate">
              {{ allItems.length }} post{{ allItems.length !== 1 ? 's' : '' }} ·
              {{ columnGroups.length }} column{{ columnGroups.length !== 1 ? 's' : '' }} ·
              {{ loopsLabel }} each
              <span v-if="randomize"> · Shuffled</span>
            </p>
          </div>

          <!-- close -->
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            @click="emit('update:isVisible', false)"
          >
            <UIcon name="i-lucide-x" />
          </button>
        </div>

        <!-- ── body ──────────────────────────────────────────────────────── -->

        <!-- loading -->
        <div v-if="isLoading" class="flex-1 flex flex-col items-center justify-center gap-3">
          <LoadingSpinner size="48px" :stroke-width="3" />
          <p class="text-sm text-white/40">Loading…</p>
        </div>

        <!-- error -->
        <div v-else-if="loadError" class="flex-1 flex flex-col items-center justify-center gap-3">
          <UIcon name="i-lucide-triangle-alert" class="text-4xl text-red-400" />
          <p class="text-sm text-white/60">Couldn't load posts.</p>
          <button class="text-sm text-violet-400 hover:text-violet-300 underline" @click="fetchAll">
            Try again
          </button>
        </div>

        <!-- empty -->
        <div
          v-else-if="allItems.length === 0"
          class="flex-1 flex flex-col items-center justify-center gap-2"
        >
          <UIcon name="i-lucide-inbox" class="text-4xl text-white/20" />
          <p class="text-sm text-white/40">No posts to play.</p>
        </div>

        <!-- columns -->
        <div v-else class="flex-1 flex gap-2 p-2 overflow-hidden min-h-0">
          <SlideshowColumn
            v-for="(group, i) in columnGroups"
            :key="i"
            :items="group"
            :loops-per-content="loopsPerContent"
            :is-globally-playing="isPlaying"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ss-overlay-enter-active,
.ss-overlay-leave-active {
  transition: opacity 0.2s ease;
}
.ss-overlay-enter-from,
.ss-overlay-leave-to {
  opacity: 0;
}
</style>
