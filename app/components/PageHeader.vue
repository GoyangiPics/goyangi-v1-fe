<script setup lang="ts">
defineProps<{
  emoji?: string
  icon?: string
  title: string
  total?: number | null
  totalLabel?: string
}>()
</script>

<template>
  <div class="flex items-center gap-2.5 mb-4">
    <span v-if="emoji" class="text-2xl leading-none">{{ emoji }}</span>
    <i v-else-if="icon" class="text-xl text-pink-300" :class="[icon]" />
    <h1 class="text-xl font-semibold tracking-tight text-night-50">
      {{ title }}
    </h1>
    <span v-if="typeof total === 'number'" class="text-xs text-night-500 font-mono mt-0.5">
      {{ total.toLocaleString() }} {{ totalLabel ?? 'total' }}
    </span>
    <div class="ml-auto flex items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
