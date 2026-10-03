<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{
  model: DropdownMenuItem[]
}>()
</script>

<template>
  <UDropdownMenu :items="model">
    <UButton
      icon="i-lucide-wrench"
      color="info"
      size="xs"
      square
      class="rounded-full shadow-lg"
      aria-label="Actions"
    />
  </UDropdownMenu>
</template>
