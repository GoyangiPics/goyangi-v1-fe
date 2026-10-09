<script setup lang="ts">
/**
 * Select-all plus the three bulk copy buttons, for list-view listings.
 *
 * Explicit props/emits rather than taking useRowSelection's return object as one
 * prop — that's the convention everywhere else here (see ListingPaginator) and it
 * keeps the component usable in isolation.
 *
 * Markup lifted from the upload results panel so the two read identically; the
 * upload page itself still has its own copy, which is a deliberate follow-up
 * rather than a precondition (see the commit note).
 */
defineProps<{
  previewCount: number
  sdCount: number
  hdCount: number
  selectableCount: number
  selectedCount: number
  allSelected: boolean
  someSelected: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:allSelected': [value: boolean]
  copy: [kind: 'preview' | 'sd' | 'hd']
  clear: []
}>()
</script>

<template>
  <div
    v-if="selectableCount"
    class="flex flex-wrap items-center gap-2 mb-3 p-3 rounded-xl border border-white/8 bg-white/2"
  >
    <UCheckbox
      :model-value="allSelected"
      :indeterminate="someSelected"
      label="Select all"
      size="sm"
      class="mr-1"
      @update:model-value="emit('update:allSelected', !!$event)"
    />

    <UButton
      v-if="previewCount"
      :label="`Copy preview links (${previewCount})`"
      icon="i-simple-icons-discord"
      size="sm"
      color="neutral"
      variant="outline"
      title="Best for Discord"
      :disabled="disabled"
      @click="emit('copy', 'preview')"
    />
    <UButton
      v-if="sdCount"
      :label="`Copy SD links (${sdCount})`"
      icon="i-lucide-copy"
      size="sm"
      color="neutral"
      variant="outline"
      title="Plays everywhere"
      :disabled="disabled"
      @click="emit('copy', 'sd')"
    />
    <UButton
      v-if="hdCount"
      :label="`Copy HD links (${hdCount})`"
      icon="i-lucide-copy"
      size="sm"
      color="neutral"
      variant="outline"
      title="Best quality"
      :disabled="disabled"
      @click="emit('copy', 'hd')"
    />

    <div class="ml-auto flex items-center gap-2">
      <span class="text-sm text-night-500 font-mono">{{ selectedCount }} selected</span>
      <UButton
        v-if="selectedCount"
        icon="i-lucide-x"
        size="xs"
        color="neutral"
        variant="ghost"
        aria-label="Clear selection"
        @click="emit('clear')"
      />
    </div>

    <slot name="actions" />
  </div>
</template>
