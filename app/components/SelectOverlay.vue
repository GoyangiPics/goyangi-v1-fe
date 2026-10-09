<script setup lang="ts">
/**
 * Puts a card into select mode: a layer over it takes the click, so tapping
 * anywhere on the card selects it instead of opening it. Wraps any card, so
 * grids get selection without every card component learning about it.
 */
defineProps<{
  active: boolean
  selected: boolean
  /** Shown dimmed and unclickable — e.g. someone else's post in your bulk edit. */
  disabled?: boolean
}>()

const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <div class="relative">
    <slot />
    <button
      v-if="active"
      type="button"
      class="absolute inset-0 z-40 rounded-xl transition-colors"
      :class="[
        selected ? 'ring-3 ring-pink-400 bg-pink-500/15' : 'hover:bg-white/5',
        disabled ? 'cursor-not-allowed bg-night-950/50' : 'cursor-pointer',
      ]"
      :aria-pressed="selected"
      :disabled="disabled"
      :aria-label="selected ? 'Deselect' : 'Select'"
      @click.stop.prevent="emit('toggle')"
    >
      <span
        class="absolute top-2 left-2 size-6 rounded-full border-2 flex items-center justify-center shadow-md"
        :class="selected ? 'bg-pink-500 border-pink-500' : 'bg-night-950/70 border-white/70'"
      >
        <UIcon v-if="selected" name="i-lucide-check" class="text-white text-sm" />
      </span>
    </button>
  </div>
</template>
