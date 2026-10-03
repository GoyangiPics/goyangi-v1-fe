<script setup lang="ts">
/**
 * View count, shown on detail pages only.
 *
 * Deliberately not on cards: views are counted without dedupe, so the number
 * partly reflects refreshes, and CardChips already overflows into a "more..."
 * toggle — a fourth always-present chip would push idol/group behind it. If it's
 * ever wanted on a card, CardStackedContent (set/collection stacks) is the right
 * first surface: lower density, and the set-level number is the meaningful one.
 */
const props = defineProps<{
  views?: number | null
}>()

const label = computed(() => (props.views ?? 0).toLocaleString())
</script>

<template>
  <!-- v-if on the tooltip, not the badge: gating only the badge would leave an
       empty tooltip wrapper in the DOM while the count is still null. -->
  <UTooltip v-if="typeof views === 'number'" :text="`${label} views`" :content="{ side: 'top' }">
    <UBadge
      icon="i-lucide-eye"
      color="neutral"
      variant="soft"
      :label="label"
      class="select-none cursor-help"
    />
  </UTooltip>
</template>
