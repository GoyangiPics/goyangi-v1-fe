<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { computed, ref } from 'vue'

/**
 * The idol/group/tag/date chip row shown under card media, collapsed to two
 * lines with a "more..." toggle when it overflows. Shared by CardUnified,
 * CardBaseContent and CardStackedContent.
 */
const props = defineProps<{
  /** Record with expanded relations — ContentsItem, SetsItem or CollectionsItem. */
  content: any
  /** Sets/collections have no "actual" content date — show a plain Created tooltip. */
  simpleDate?: boolean
}>()

const emit = defineEmits<{
  filtersApply: [value: any, type: 'idol' | 'group' | 'tag' | 'label']
}>()

const chipsRef = ref<HTMLElement | null>(null)
const chipsExpanded = ref(false)
const hasChipsOverflow = ref(false)
/** Height of the first chip row in px (fractional), measured — the collapsed clamp. */
const rowHeight = ref(0)

// Re-measure whenever layout settles (media load, v-show reveal, resize).
// Skip while expanded — clientHeight equals scrollHeight then, which would
// hide the collapse button.
//
// The clamp is measured off the first chip rather than written as a Tailwind
// height: a badge is text line-height plus spacing-unit padding, so no fixed
// class tracks it when either changes. `max-h-8` did exactly that when the
// spacing unit went from 4px to 3.2px — every row lost its bottom few pixels,
// and since the content then always overflowed, "more..." never went away.
useResizeObserver(chipsRef, () => {
  const el = chipsRef.value
  if (!el || chipsExpanded.value) return
  const first = el.firstElementChild as HTMLElement | null
  if (!first) return
  // The chip's bottom edge relative to the container: its top margin plus its
  // height, the row's full extent. Fractional on purpose — offsetHeight rounds,
  // and with a 3.2px spacing unit the row is 28.8px, so an integer clamp still
  // shaves the bottom of every chip.
  const row = first.getBoundingClientRect().bottom - el.getBoundingClientRect().top
  rowHeight.value = row
  // scrollHeight is rounded, hence the slack: a second row is a whole chip taller.
  hasChipsOverflow.value = el.scrollHeight > Math.ceil(row) + 1
})

const expand = () => (props.content.expand as any) ?? {}

/**
 * Provenance. See contentOrigin for why `mirror` was the wrong signal and what
 * replaced it.
 *
 * No `simpleDate` gate any more: contentOrigin returns null for anything without
 * a provenance field, so sets pick the chip up on their own once `origin` is
 * backfilled onto them, and collections (which have neither field) stay silent.
 */
const origin = computed(() => contentOrigin(props.content))
const isDirectUpload = computed(() => origin.value === 'direct')
const isImgurImport = computed(() => origin.value === 'imgur')

const labelsOpen = ref(false)
const labels = computed<any[]>(() => expand().labels ?? [])

/**
 * Count included once there's more than one: the chip's job is to say "there are
 * labels here", and the number is what tells you whether opening it is worth it.
 */
const labelChipText = computed(() =>
  labels.value.length > 1 ? `Labels · ${labels.value.length}` : 'Label',
)

function applyLabelFilter(label: any) {
  // Close first — applying a filter refetches the listing underneath, and a
  // popover left anchored to a chip that may no longer exist looks broken.
  labelsOpen.value = false
  emit('filtersApply', label, 'label')
}
</script>

<template>
  <div class="flex items-center mt-0.5 gap-1">
    <!-- Collapsed height is exactly one chip row, measured in the observer
         above. Any more and the row pads out by the difference whenever chips
         wrap; any less and every chip loses its bottom edge.

         The class is the same row spelled out for the server render and the
         moment before the observer fires: mt-2 plus the badge's py-1 either
         side is 4 spacing units, and text-xs has a 1rem line-height. The
         measured value takes over as soon as there is one. -->
    <div
      ref="chipsRef"
      class="flex flex-wrap flex-1 overflow-hidden"
      :class="[!chipsExpanded && !rowHeight ? 'max-h-[calc(var(--spacing)*4+1rem)]' : '']"
      :style="!chipsExpanded && rowHeight ? { maxHeight: `${rowHeight}px` } : undefined"
    >
      <UBadge
        v-for="idol in expand().idol"
        :key="idol.id"
        icon="i-lucide-star"
        variant="soft"
        :label="idol.name"
        class="select-none cursor-pointer hover:bg-pink-900! mr-2 mt-2"
        @click="emit('filtersApply', idol, 'idol')"
      />
      <UBadge
        v-for="group in expand().group"
        :key="group.id"
        icon="i-lucide-at-sign"
        color="info"
        variant="soft"
        :label="group.name"
        class="select-none cursor-pointer hover:bg-blue-900! mr-2 mt-2"
        @click="emit('filtersApply', group, 'group')"
      />
      <UBadge
        v-for="tag in expand().tag"
        :key="tag.id"
        icon="i-lucide-tags"
        color="error"
        variant="soft"
        :label="tag.name"
        class="select-none cursor-pointer hover:bg-red-900! mr-2 mt-2"
        @click="emit('filtersApply', tag, 'tag')"
      />
      <!-- User-created labels collapse into one chip rather than listing every
           name. A card may carry up to 30 (maxLabelsPerContent), and spelling
           them out crowded out the curated tags beside them. `outline` is still
           the signal that this is the user namespace, not a curated tag.

           Click, not hover: the panel's own chips are the filter affordance, and
           a hover-only reveal would leave touch users no way in. -->
      <UPopover v-if="labels.length" v-model:open="labelsOpen" :content="{ side: 'top' }">
        <UBadge
          icon="i-lucide-tag"
          color="primary"
          variant="outline"
          :label="labelChipText"
          class="select-none cursor-pointer hover:bg-primary-900! mr-2 mt-2"
          @click.stop
        />
        <template #content>
          <div class="flex flex-wrap gap-1 p-2 max-w-3xs">
            <UBadge
              v-for="label in labels"
              :key="label.id"
              icon="i-lucide-tag"
              color="primary"
              variant="outline"
              :label="label.name"
              class="select-none cursor-pointer hover:bg-primary-900!"
              @click="applyLabelFilter(label)"
            />
          </div>
        </template>
      </UPopover>
      <UTooltip
        v-if="simpleDate && content.created"
        :text="`Created: ${formatShortDate(content.created)}`"
        :content="{ side: 'top' }"
      >
        <UBadge
          icon="i-lucide-calendar"
          color="neutral"
          variant="soft"
          :label="formatShortDate(content.created)"
          class="select-none cursor-help mr-2 mt-2"
        />
      </UTooltip>
      <UTooltip
        v-else-if="!simpleDate && hasOwnDate(content)"
        :text="`Created: ${formatShortDate(content.created)} Actual: ${formatShortDate(content.date)}`"
        :content="{ side: 'top' }"
      >
        <UBadge
          icon="i-lucide-calendar"
          color="neutral"
          variant="soft"
          :label="formatShortDate(content.date)"
          class="select-none cursor-help mr-2 mt-2"
        />
      </UTooltip>
      <UTooltip
        v-else-if="!simpleDate && content.created"
        :text="`Created: ${formatShortDate(content.created)} Actual: same day`"
        :content="{ side: 'top' }"
      >
        <UBadge
          icon="i-lucide-calendar"
          color="neutral"
          variant="soft"
          :label="formatShortDate(content.created)"
          class="select-none cursor-help mr-2 mt-2"
        />
      </UTooltip>
      <!-- Last in the row on purpose — provenance is the least important thing
           here, and keeping it at the end means it's the first to be hidden
           when the row collapses. -->
      <UTooltip
        v-if="isDirectUpload"
        text="Uploaded directly on the site (not scraped from Discord)"
        :content="{ side: 'top' }"
      >
        <UBadge
          icon="i-lucide-upload"
          color="success"
          variant="soft"
          label="Direct"
          class="select-none cursor-help mr-2 mt-2"
        />
      </UTooltip>
      <UTooltip
        v-if="isImgurImport"
        text="Imported from an imgur link on the site"
        :content="{ side: 'top' }"
      >
        <UBadge
          icon="i-simple-icons-imgur"
          color="success"
          variant="soft"
          label="Imgur"
          class="select-none cursor-help mr-2 mt-2"
        />
      </UTooltip>
    </div>
    <button
      v-if="hasChipsOverflow"
      type="button"
      class="shrink-0 self-start mt-2 h-6 px-2 rounded-md text-xs text-night-400 hover:text-white hover:bg-night-700 transition-colors cursor-pointer select-none inline-flex items-center"
      @click.stop="chipsExpanded = !chipsExpanded"
    >
      {{ chipsExpanded ? '↑' : 'more...' }}
    </button>
  </div>
</template>
