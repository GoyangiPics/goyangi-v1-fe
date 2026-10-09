<script setup lang="ts">
/**
 * A bar for actions on the current selection.
 *
 * Kept separate from CopyLinksBar: that one is copy-oriented and always shown in
 * list view, this one is action-oriented and appears once something is selected.
 * Both can render at once.
 *
 * `floating` pins it near the bottom of the screen, so a long grid can be
 * scrolled and selected through with the actions always in reach — above the
 * floating paginator (ListingPaginator, the bottom ~70px), which every page
 * with a selection also has. Inline otherwise, for pages that show more than
 * one selection at a time.
 */
withDefaults(
  defineProps<{
    selectedCount: number
    floating?: boolean
    /** Everything the listing matches; offers "Select all" when more than is selected. */
    matchingCount?: number
    isSelectingAll?: boolean
  }>(),
  { floating: false, matchingCount: 0, isSelectingAll: false },
)

const emit = defineEmits<{
  clear: []
  selectAll: []
}>()
</script>

<template>
  <div
    v-if="selectedCount"
    class="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-primary/30"
    :class="
      floating
        ? 'fixed bottom-22 left-1/2 -translate-x-1/2 z-50 w-max max-w-[calc(100vw-2rem)] bg-night-950/95 backdrop-blur-md shadow-2xl'
        : 'mb-3 bg-primary/5'
    "
  >
    <span class="text-xs font-medium">{{ selectedCount }} selected</span>
    <UButton
      v-if="matchingCount > selectedCount"
      :label="`Select all ${matchingCount.toLocaleString()}`"
      size="xs"
      color="neutral"
      variant="link"
      :loading="isSelectingAll"
      @click="emit('selectAll')"
    />

    <div class="ml-auto flex flex-wrap items-center gap-2">
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
