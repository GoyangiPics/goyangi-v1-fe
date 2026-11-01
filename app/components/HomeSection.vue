<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

/** A titled block on the trial home pages, with an optional "See all" hand-off. */
defineProps<{
  title: string
  subtitle?: string
  /** Anchor id, for the jump pills. */
  anchor?: string
  to?: RouteLocationRaw
  toLabel?: string
}>()
</script>

<template>
  <section :id="anchor" class="scroll-mt-6">
    <div class="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
      <div class="min-w-0">
        <h2 class="font-display text-[22px] font-semibold text-night-50">{{ title }}</h2>
        <p v-if="subtitle" class="text-sm text-night-300">{{ subtitle }}</p>
      </div>
      <div class="flex items-center gap-3">
        <slot name="actions" />
        <NuxtLink
          v-if="to"
          :to="to"
          class="flex items-center gap-1 text-sm font-semibold text-pink-400 hover:text-pink-300"
        >
          {{ toLabel ?? 'See all' }}
          <UIcon name="i-lucide-arrow-right" class="size-4" />
        </NuxtLink>
      </div>
    </div>
    <slot />
  </section>
</template>
