<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  emoji?: string
  icon?: string
  title: string
  total?: number | null
  /** Plural noun ("posts", "sets"). Singular is derived for a count of one. */
  totalLabel?: string
}>()

// Every label in use is a regular plural, so dropping the "s" is enough — and
// it saves each page from carrying its own `total === 1 ? … : …`.
const label = computed(() => {
  const plural = props.totalLabel ?? 'total'
  return props.total === 1 && plural.endsWith('s') ? plural.slice(0, -1) : plural
})
</script>

<template>
  <div class="flex items-center gap-2.5 mb-4">
    <span v-if="emoji" class="text-2xl leading-none">{{ emoji }}</span>
    <i v-else-if="icon" class="text-xl text-pink-300" :class="[icon]" />
    <h1 class="text-xl font-semibold tracking-tight text-night-50">
      {{ title }}
    </h1>
    <span v-if="typeof total === 'number'" class="text-xs text-night-500 font-mono mt-0.5">
      {{ total.toLocaleString() }} {{ label }}
    </span>
    <div class="ml-auto flex items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
