<script setup lang="ts">
/**
 * UInputDate + UCalendar popover — the "date picker" assembly Nuxt UI
 * doesn't ship as a single component. Type into the segmented input or
 * pick visually from the calendar.
 */
const props = withDefaults(
  defineProps<{
    range?: boolean
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    // Teleport the calendar to <body> (default). Set false ONLY inside a
    // UModal: a modal traps pointer events to its own DOM, so a body-portaled
    // calendar would be unclickable — it must render within the modal instead.
    portal?: boolean
  }>(),
  {
    portal: true,
  },
)

// CalendarDate for single fields, { start, end } for ranges — the same
// shapes UInputDate and UCalendar both speak.
const model = defineModel<any>()

const isCalendarOpen = ref(false)

// Close once the pick is complete: any value for single fields, both ends
// for ranges.
watch(model, (value) => {
  if (!isCalendarOpen.value || !value) return
  if (!props.range || (value.start && value.end)) isCalendarOpen.value = false
})
</script>

<template>
  <div class="flex items-center gap-1.5">
    <UInputDate v-model="model" :range="range" :size="size" class="flex-1 min-w-0" />
    <!--
      Teleport to <body> by default so the calendar floats above surrounding
      fields and isn't clipped/stacked-under by an ancestor's overflow. Inside
      a modal, pass portal=false so it renders within the modal (a modal blocks
      pointer events outside its own DOM, which would make a portaled calendar
      unclickable). In a non-modal popover (filters panel) the teleported
      calendar is a nested Reka branch, so it won't dismiss the parent.
    -->
    <!--
      z-index only matters in the un-portalled case. Rendering inline puts the
      calendar in the modal's own stacking context, where UModal's footer is a
      later positioned sibling and therefore paints over it — the calendar
      appeared behind the Cancel/Save row. A portalled calendar sits at the end
      of <body> and needs none of this.
    -->
    <UPopover
      v-model:open="isCalendarOpen"
      :portal="portal"
      :content="{ side: 'bottom', align: 'end', collisionPadding: 8 }"
      :ui="portal ? undefined : { content: 'z-50' }"
    >
      <UButton
        icon="i-lucide-calendar"
        color="neutral"
        variant="subtle"
        :size="size"
        aria-label="Open calendar"
      />
      <template #content>
        <UCalendar v-model="model" :range="range" :size="size" class="p-2" />
      </template>
    </UPopover>
  </div>
</template>
