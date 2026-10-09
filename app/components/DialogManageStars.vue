<script setup lang="ts">
import { computed } from 'vue'

/**
 * Star management: pick the idols and groups /me/feed should follow.
 *
 * Group and idol stars are INDEPENDENT here. Starring a group means "everything
 * from this group" and tracks its lineup over time; starring nine idols means
 * those nine. The filter dialog collapses a fully-selected group into one group
 * chip, which is right for a filter and wrong here — it would silently turn one
 * subscription into a different one.
 */
defineProps<{
  isVisible: boolean
}>()

const emit = defineEmits<{
  'update:isVisible': [value: boolean]
}>()

const referenceStore = useReferenceStore()
const starsStore = useStarsStore()

// The starred idols, in the shape useGroupedIdolSelection wants for its tri-state.
const starredIdolRefs = computed(() => starsStore.idolIds.map((id) => ({ id })))

const { searchTerm, filteredGroups, groupCheckState } = useGroupedIdolSelection(
  () => starredIdolRefs.value,
  () => referenceStore.idols,
  () => referenceStore.groups,
)

/** Star or unstar every visible member of a group — not the group itself. */
function toggleVisibleMembers(items: Array<{ id: string }>) {
  const state = groupCheckState(items)
  for (const item of items) {
    const starred = starsStore.isIdolStarred(item.id)
    // state===true means all are starred, so this clears them; otherwise fill in
    // the gaps without unstarring what's already there.
    if (state === true && starred) starsStore.toggleIdol(item.id)
    else if (state !== true && !starred) starsStore.toggleIdol(item.id)
  }
}

function close() {
  emit('update:isVisible', false)
}
</script>

<template>
  <UModal
    :open="isVisible"
    title="Manage stars"
    :ui="{ content: 'sm:max-w-lg' }"
    @update:open="emit('update:isVisible', $event)"
  >
    <template #body>
      <p class="text-xs text-night-500 mb-3">
        Star groups or idols to see their posts in your feed.
      </p>

      <UInput
        v-model="searchTerm"
        placeholder="Search idols and groups…"
        icon="i-lucide-search"
        class="w-full mb-3"
      />

      <div class="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
        <div v-for="group in filteredGroups" :key="group.gid">
          <!-- Group header: its own star (follow the group) plus a tri-state
               checkbox that stars/unstars the visible members. Two distinct
               actions on purpose, per the note in the script block. -->
          <div class="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-white/8">
            <UCheckbox
              :model-value="
                groupCheckState(group.items) === 'indeterminate'
                  ? 'indeterminate'
                  : groupCheckState(group.items)
              "
              size="sm"
              :aria-label="`Star all idols in ${group.label}`"
              @update:model-value="toggleVisibleMembers(group.items)"
            />
            <span class="text-sm font-semibold flex-1">{{ group.label }}</span>
            <!-- Same icon either way; filled-vs-outline is the state, which is
                 also how the idol star badge reads. -->
            <UButton
              icon="i-lucide-star"
              :class="starsStore.isGroupStarred(group.gid) ? 'icon-filled text-amber-400' : ''"
              size="xs"
              color="neutral"
              variant="ghost"
              :title="
                starsStore.isGroupStarred(group.gid)
                  ? `Unstar ${group.label}`
                  : `Star ${group.label}`
              "
              @click="starsStore.toggleGroup(group.gid)"
            />
          </div>

          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="idol in group.items"
              :key="idol.id"
              type="button"
              class="flex items-center gap-1 pl-2 pr-2 py-1 rounded-full border text-xs transition-colors"
              :class="
                starsStore.isIdolStarred(idol.id)
                  ? 'border-amber-400/50 bg-amber-400/10 text-amber-200'
                  : 'border-white/10 bg-white/5 text-night-300 hover:bg-white/10'
              "
              @click="starsStore.toggleIdol(idol.id)"
            >
              <UIcon
                name="i-lucide-star"
                :class="starsStore.isIdolStarred(idol.id) ? 'icon-filled' : ''"
                class="text-xs"
              />
              {{ idol.name }}
            </button>
          </div>
        </div>

        <p v-if="!filteredGroups.length" class="text-center text-xs text-night-500 py-4">
          No matches for "{{ searchTerm }}".
        </p>
      </div>
    </template>

    <template #footer>
      <UButton label="Done" color="neutral" block @click="close" />
    </template>
  </UModal>
</template>
