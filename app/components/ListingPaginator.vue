<script setup lang="ts">
import type { PageState } from '~/types/listing'

const props = defineProps<{
  first: number
  rows: number
  total: number
}>()

const emit = defineEmits<{
  page: [PageState]
}>()

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.rows)))

const page = computed({
  get: () => Math.floor(props.first / props.rows) + 1,
  set: (value: number) => {
    const next = Math.max(1, value)
    emit('page', {
      first: (next - 1) * props.rows,
      rows: props.rows,
      page: next - 1,
      pageCount: pageCount.value,
    })
  },
})

// Jump-to-page field (the old PrimeVue paginator template ended with
// JumpToPageInput). Mirrors the current page; commits on Enter/blur.
const jumpValue = ref(String(page.value))
watch(page, (p) => {
  jumpValue.value = String(p)
})

function commitJump() {
  const parsed = Number.parseInt(jumpValue.value, 10)
  if (Number.isNaN(parsed)) {
    jumpValue.value = String(page.value)
    return
  }
  const clamped = Math.min(Math.max(1, parsed), pageCount.value)
  jumpValue.value = String(clamped)
  if (clamped !== page.value) page.value = clamped
}
</script>

<template>
  <!-- Shrink-to-fit and centred with left-1/2, rather than a left-0/right-0 flex
       row: this is `fixed` at z-50, so a full-width wrapper was an invisible
       viewport-wide strip that swallowed every click landing on the cards level
       with it.

       pointer-events as well as the narrower box, because width alone doesn't
       finish the job — the p-4 that lifts the pill off the bottom edge is part of
       the wrapper, so it would go on eating clicks in a band around the pill.
       Only the pill itself takes pointer events now. -->
  <div class="fixed p-4 bottom-0 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
    <div
      class="pointer-events-auto flex items-center gap-1 rounded-lg bg-night-800/95 p-1 shadow-[0_3px_8px_rgba(0,0,0,0.8)]"
    >
      <UPagination
        v-model:page="page"
        :total="total"
        :items-per-page="rows"
        :sibling-count="1"
        show-edges
        color="neutral"
        variant="ghost"
        active-color="primary"
      />
      <UInput
        v-model="jumpValue"
        type="number"
        :min="1"
        :max="pageCount"
        aria-label="Jump to page"
        class="w-14"
        :ui="{
          base: 'text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        }"
        @keydown.enter="commitJump"
        @blur="commitJump"
      />
    </div>
  </div>
</template>
