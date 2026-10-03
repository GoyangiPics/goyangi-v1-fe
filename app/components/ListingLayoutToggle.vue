<script setup lang="ts">
import { onMounted } from 'vue'

/**
 * Grid ⇄ list toggle for a listing page, persisted per page.
 *
 * NOT the same thing as the home page's toggle, which is a *grouping* choice
 * (sets vs individual contents — two different datasets). This is a *layout*
 * choice over one dataset. They were given the grid/list icon pair originally,
 * which is exactly what a layout toggle needs, so the home one moved to
 * layers/rows to keep the two distinguishable.
 */
const layout = defineModel<'grid' | 'list'>({ default: 'grid' })

const props = defineProps<{
  /** Distinguishes the persisted value per page, e.g. "me-sets". */
  storageKey: string
}>()

const storageId = () => `listingLayout:${props.storageKey}`

// localStorage only exists client-side; read after mount so SSR and the first
// client render agree.
onMounted(() => {
  const saved = localStorage.getItem(storageId())
  if (saved === 'grid' || saved === 'list') layout.value = saved
})

function setLayout(next: 'grid' | 'list') {
  layout.value = next
  localStorage.setItem(storageId(), next)
}
</script>

<template>
  <div class="flex items-center gap-1 rounded-lg bg-elevated p-1">
    <UButton
      icon="i-lucide-layout-grid"
      size="xs"
      :color="layout === 'grid' ? 'primary' : 'neutral'"
      :variant="layout === 'grid' ? 'solid' : 'ghost'"
      aria-label="Grid view"
      title="Grid view"
      @click="setLayout('grid')"
    />
    <UButton
      icon="i-lucide-list"
      size="xs"
      :color="layout === 'list' ? 'primary' : 'neutral'"
      :variant="layout === 'list' ? 'solid' : 'ghost'"
      aria-label="List view"
      title="List view"
      @click="setLayout('list')"
    />
  </div>
</template>
