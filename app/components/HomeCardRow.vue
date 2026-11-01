<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'

/**
 * One horizontal row of today's content cards, scrolled sideways.
 *
 * The cards are the real CardBaseContent, unchanged — the home trials are about
 * layout, and the card gets its own pass later. Fixed-width columns with the
 * card's own height, so a wide gif and a tall photo sit side by side top-aligned
 * instead of being cropped to one shape.
 */
withDefaults(
  defineProps<{
    items: ContentsItem[]
    loading: boolean
    /** Card width in px. */
    width?: number
  }>(),
  { width: 272 },
)

const emit = defineEmits(['changed'])

const openInFeed = useFeedHandoff()
</script>

<template>
  <div class="-mx-1 overflow-x-auto px-1 pb-3">
    <div class="flex items-start gap-4">
      <template v-if="loading">
        <USkeleton
          v-for="i in 5"
          :key="i"
          class="shrink-0 h-[360px] rounded-xl"
          :style="{ width: `${width}px` }"
        />
      </template>
      <div
        v-for="item in items"
        v-else
        :key="item.id"
        class="shrink-0"
        :style="{ width: `${width}px` }"
      >
        <CardBaseContent :content="item" @changed="emit('changed')" @filters-apply="openInFeed" />
      </div>
    </div>
  </div>
</template>
