<script setup lang="ts">
/**
 * "New since your last visit", in a card's header row beside the title.
 *
 * Inline rather than overlaid: as an overlay it either hung off the card's
 * corner or sat on top of the title. Quiet on purpose — a page of new posts is
 * a page of these, so the pink is a dot, not a fill.
 */
</script>

<template>
  <span
    class="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-night-800 text-night-300 text-[10px] font-medium leading-none select-none"
  >
    <span class="size-1.5 rounded-full bg-pink-500" />
    New
  </span>
</template>
