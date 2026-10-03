<script setup lang="ts">
import { MostLikedModes } from '~/types/typesFilters'

const emit = defineEmits(['filtersApply'])
const filtersStore = useFiltersStore()
const { isMobile } = useWindowSize()

const buttons = [
  { label: 'All Time', shortLabel: 'All', mode: MostLikedModes.AllTime },
  { label: '1 Year', shortLabel: '1y', mode: MostLikedModes.OneYear },
  { label: '6 Months', shortLabel: '6m', mode: MostLikedModes.SixMonths },
  { label: '3 Months', shortLabel: '3m', mode: MostLikedModes.ThreeMonths },
  { label: '1 Month', shortLabel: '1m', mode: MostLikedModes.OneMonth },
  { label: '1 Week', shortLabel: '1w', mode: MostLikedModes.OneWeek },
]

function filtersApply(mode: MostLikedModes) {
  filtersStore.setMostLikedMode(mode)
  emit('filtersApply')
}
</script>

<template>
  <div class="flex items-stretch gap-2 w-full mt-2">
    <div class="flex-1 flex items-stretch gap-1.5 bg-night-800 nav-container">
      <button
        v-for="button in buttons"
        :key="button.mode"
        class="nav-tab flex-1"
        :class="filtersStore.mostLikedMode === button.mode ? 'nav-tab-active' : 'nav-tab-inactive'"
        @click="filtersApply(button.mode)"
      >
        {{ isMobile ? button.shortLabel : button.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Shared .nav-container/.nav-tab styles live in main.css; this row uses a
   lighter active shade to read as a secondary (date-range) selector. */
.nav-tab-active {
  background: var(--color-pink-300);
}
</style>
