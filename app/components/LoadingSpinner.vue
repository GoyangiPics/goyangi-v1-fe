<script setup lang="ts">
/** Replacement for PrimeVue's ProgressSpinner (same 100px default size). */
withDefaults(
  defineProps<{
    size?: string
    strokeWidth?: string | number
  }>(),
  {
    size: '100px',
    strokeWidth: 4,
  },
)
</script>

<template>
  <svg
    class="animate-spin text-(--ui-primary)"
    :style="{ width: size, height: size }"
    viewBox="0 0 24 24"
    fill="none"
    role="progressbar"
    aria-label="Loading"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      class="opacity-20"
      stroke="currentColor"
      :stroke-width="strokeWidth"
    />
    <path
      d="M22 12a10 10 0 0 1-10 10"
      stroke="currentColor"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
    />
  </svg>
</template>
