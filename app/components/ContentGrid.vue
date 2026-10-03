<!-- `id` is only ever used as a :key, which takes either — and the tools pages'
     ImgurItem numbers its items, so a string-only constraint would have kept them
     on their own grid implementation for no reason. -->
<script setup lang="ts" generic="T extends { id: string | number }">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Pre-distributed masonry columns (see useMasonry). */
    columns: T[][]
    /** Gap between cards: 6 (content cards) or 8 (set/collection cards). */
    gap?: 6 | 8
  }>(),
  {
    gap: 6,
  },
)

defineSlots<{
  default: (props: { item: T }) => any
}>()

// Full static classes so Tailwind's scanner picks them up.
const gapClass = computed(() => (props.gap === 8 ? 'gap-8' : 'gap-6'))
</script>

<template>
  <div class="flex items-start w-full" :class="gapClass">
    <div
      v-for="(colItems, colIndex) in columns"
      :key="colIndex"
      class="flex flex-col flex-1 min-w-0"
      :class="gapClass"
    >
      <div v-for="item in colItems" :key="item.id">
        <slot :item="item" />
      </div>
    </div>
  </div>
</template>
