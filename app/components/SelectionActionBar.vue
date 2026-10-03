<script setup lang="ts">
/**
 * A thin bar for actions on the current selection.
 *
 * Kept separate from CopyLinksBar: that one is copy-oriented and always shown in
 * list view, this one is action-oriented and appears only for people who have the
 * actions. Both can render at once.
 */
defineProps<{
  selectedCount: number
}>()

const emit = defineEmits<{
  clear: []
}>()
</script>

<template>
  <div
    v-if="selectedCount"
    class="flex flex-wrap items-center gap-2 mb-3 p-3 rounded-xl border border-primary/30 bg-primary/5"
  >
    <span class="text-xs font-medium"> {{ selectedCount }} selected </span>

    <div class="ml-auto flex items-center gap-2">
      <slot name="actions" />
      <UButton
        icon="i-lucide-x"
        size="xs"
        color="neutral"
        variant="ghost"
        label="Clear"
        @click="emit('clear')"
      />
    </div>
  </div>
</template>
