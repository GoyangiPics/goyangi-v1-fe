<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { DownloadableItem } from '~/composables/useDownloadAll'
import { computed } from 'vue'

/**
 * Bulk download for a listing, with the rendition as a choice.
 *
 * A menu rather than two buttons, which is where this departs from CopyLinksBar's
 * one-button-per-rendition layout: that bar is full width, whereas this sits in a
 * PageHeader actions row that goes icon-only on mobile — and two buttons both
 * carrying the download icon would be indistinguishable there.
 *
 * Shared by the set and collection pages so the two can't drift.
 */
const props = defineProps<{
  items: readonly DownloadableItem[]
}>()

const { isMobile } = useWindowSize()
const { isDownloadingAll, downloadAll } = useDownloadAll()

const hdCount = computed(() => renditionCount(props.items, 'hd'))
const sdCount = computed(() => renditionCount(props.items, 'sd'))

/**
 * Only offer the choice when there is one. `sd` is best-effort backend-side and
 * absent on records predating it, so a set can legitimately have none — and a
 * menu with a single entry is just a button wearing a hat.
 */
const hasChoice = computed(() => sdCount.value > 0)

const menuItems = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: `HD mp4 (${hdCount.value})`,
      slot: 'hd',
      // AV1: best quality, and the rendition older Apple devices cannot decode.
      onSelect: () => void downloadAll(props.items, 'hd'),
    },
    {
      label: `SD mp4 (${sdCount.value})`,
      slot: 'sd',
      onSelect: () => void downloadAll(props.items, 'sd'),
    },
  ],
])
</script>

<template>
  <UDropdownMenu
    v-if="hasChoice"
    :items="menuItems"
    :content="{ side: 'bottom', align: 'end', sideOffset: 2 }"
  >
    <UButton
      icon="i-lucide-download"
      :label="isMobile ? undefined : 'Download All'"
      trailing-icon="i-lucide-chevron-down"
      color="neutral"
      variant="outline"
      size="sm"
      :loading="isDownloadingAll"
    />

    <!-- Text glyphs from app/assets/cards.css, matching how ContentActionsMenu
         labels the same two renditions. -->
    <template #hd-leading>
      <span class="badge-hd-icon" />
    </template>
    <template #sd-leading>
      <span class="badge-sd-icon" />
    </template>

    <!-- Native `title`, for the reason ContentActionsMenu gives: this is inside
         the menu's portal, and a UTooltip there would be contending with the
         menu's own hover and keyboard handling. -->
    <template #hd-trailing>
      <span :title="AV1_COMPAT_HINT" class="flex items-center shrink-0">
        <UIcon name="i-lucide-info" class="text-night-500 text-xs" />
      </span>
    </template>
  </UDropdownMenu>

  <!-- Nothing has an SD rendition, so this is the plain action it always was. -->
  <UButton
    v-else
    icon="i-lucide-download"
    :label="isMobile ? undefined : 'Download All'"
    color="neutral"
    variant="outline"
    size="sm"
    :loading="isDownloadingAll"
    @click="downloadAll(items, 'hd')"
  />
</template>
