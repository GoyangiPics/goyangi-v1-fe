<script setup lang="ts">
/**
 * Upload-time set matching: offers existing sets that look like they belong with
 * the files being uploaded, so they land in one set rather than a duplicate.
 *
 * Renamed from DialogMergeSet, which invited confusion with DialogAdminMergeSets.
 * This merges nothing — it picks a set to upload INTO.
 */
const props = defineProps<{
  isVisible: boolean
  matchingSets: any[]
  newSetTitle: string
}>()

const emit = defineEmits<{
  'update:isVisible': [value: boolean]
  merge: [setId: string]
  createNew: []
}>()

const selectedSetId = ref<string | null>(null)

// dismissible=false also swallows Esc; the old PrimeVue dialog always
// closed on Esc (only backdrop-click was blocked), so restore that path.
defineShortcuts({
  escape: {
    usingInput: true,
    handler: () => {
      if (props.isVisible) emit('update:isVisible', false)
    },
  },
})

function selectSet(id: string) {
  selectedSetId.value = id === selectedSetId.value ? null : id
}

function confirmMerge() {
  if (!selectedSetId.value) return
  emit('merge', selectedSetId.value)
}

function createNew() {
  selectedSetId.value = null
  emit('createNew')
}
</script>

<template>
  <UModal
    :open="isVisible"
    :close="false"
    :dismissible="false"
    title="Add to an existing set?"
    :ui="{ content: 'sm:max-w-lg' }"
    @update:open="emit('update:isVisible', $event)"
  >
    <template #body>
      <div class="flex flex-col gap-3">
        <p class="text-sm text-night-400 mb-1">
          These sets have the same date and idols. Pick one to add to, or create a new set.
        </p>

        <div class="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
          <div
            v-for="set in matchingSets"
            :key="set.id"
            class="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200"
            :class="
              selectedSetId === set.id
                ? 'border-pink-500/60 bg-pink-500/10 shadow-[0_0_16px_-4px_color-mix(in_oklab,var(--color-pink-500),transparent_65%)]'
                : 'border-white/8 bg-white/3 hover:border-pink-500/30 hover:bg-white/5'
            "
            @click="selectSet(set.id)"
          >
            <div
              class="mt-0.5 w-4 h-4 shrink-0 rounded-full border-2 transition-all duration-200 flex items-center justify-center"
              :class="selectedSetId === set.id ? 'border-pink-400 bg-pink-400' : 'border-white/25'"
            >
              <div v-if="selectedSetId === set.id" class="w-1.5 h-1.5 rounded-full bg-white" />
            </div>

            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-night-100 truncate">
                {{ set.title }}
              </p>
              <div class="flex flex-wrap gap-1 mt-1.5">
                <UBadge
                  v-for="idol in set.expand?.idol"
                  :key="idol.id"
                  icon="i-lucide-star"
                  color="warning"
                  variant="soft"
                  :label="idol.name"
                  class="select-none text-xs!"
                />
                <UBadge
                  v-for="group in set.expand?.group"
                  :key="group.id"
                  icon="i-lucide-at-sign"
                  color="info"
                  variant="soft"
                  :label="group.name"
                  class="select-none text-xs!"
                />
              </div>
              <!-- Content preview strip -->
              <div v-if="set.expand?.contents_via_set?.length" class="flex gap-1 mt-2">
                <!-- One <img> for every filetype. `static` is already the video
                     poster, so the old <video preload="metadata"> branch cost a
                     round-trip per 48px tile and showed black until it landed —
                     and the <img v-else> it fell through to was fed `original`,
                     which for a gif is an AV1 mp4 an <img> cannot decode. That
                     was the broken preview: gif is the default upload type. -->
                <div
                  v-for="item in set.expand.contents_via_set.slice(0, 5)"
                  :key="item.id"
                  class="w-12 h-12 shrink-0 rounded-md overflow-hidden bg-white/5"
                >
                  <img
                    v-if="contentThumbUrl(item)"
                    :src="contentThumbUrl(item)"
                    class="w-full h-full object-cover"
                    alt=""
                  />
                </div>
                <div
                  v-if="set.expand.contents_via_set.length > 5"
                  class="w-12 h-12 shrink-0 rounded-md bg-white/5 flex items-center justify-center text-xs text-night-400 font-mono"
                >
                  +{{ set.expand.contents_via_set.length - 5 }}
                </div>
              </div>
              <p class="text-xs text-night-500 mt-1.5 font-mono">
                {{ set.expand?.contents_via_set?.length ?? 0 }}
                {{ (set.expand?.contents_via_set?.length ?? 0) === 1 ? 'post' : 'posts' }} ·
                {{ new Date(set.created).toLocaleDateString() }}
              </p>
            </div>
          </div>
        </div>

        <div class="border-t border-white/8 pt-3 mt-1">
          <div
            class="flex items-start gap-3 p-3 rounded-xl border border-white/8 bg-white/3 cursor-pointer hover:border-pink-500/30 hover:bg-white/5 transition-all duration-200"
            :class="selectedSetId === null ? '' : ''"
            @click="selectedSetId = null"
          >
            <div
              class="mt-0.5 w-4 h-4 shrink-0 rounded-full border-2 transition-all duration-200 flex items-center justify-center"
              :class="selectedSetId === null ? 'border-pink-400 bg-pink-400' : 'border-white/25'"
            >
              <div v-if="selectedSetId === null" class="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-night-100">Create new set</p>
              <p class="text-sm text-night-400 mt-0.5 font-mono truncate">
                {{ newSetTitle }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-2 justify-end">
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          @click="emit('update:isVisible', false)"
        />
        <UButton
          v-if="selectedSetId !== null"
          label="Add to set"
          icon="i-lucide-folder-open"
          color="info"
          @click="confirmMerge"
        />
        <UButton
          v-else
          label="Create new set"
          icon="i-lucide-plus"
          class="search-gradient"
          @click="createNew"
        />
      </div>
    </template>
  </UModal>
</template>
