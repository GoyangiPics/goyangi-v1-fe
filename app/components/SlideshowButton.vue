<script setup lang="ts">
import type { CollectionsItem, SetsItem } from '~/types/appTypes'
import { ref } from 'vue'

/**
 * "Slideshow" for the set and collection pages' headers.
 *
 * The slideshow was only in SetActionsMenu, the right-click menu of a card on
 * the /sets and /collections listings — so having opened a set or collection,
 * the one place you'd look for it, there was no way to start one. Same setup
 * dialog and player as that menu.
 */
defineProps<{
  content: SetsItem | CollectionsItem
  isSet: boolean
}>()

const { isMobile } = useWindowSize()

const isSetupVisible = ref(false)
const isPlaying = ref(false)
const options = ref({ columns: 1, randomize: false, loopsPerContent: 1 })

function start(opts: { columns: number; randomize: boolean; loopsPerContent: number }) {
  options.value = opts
  isPlaying.value = true
}
</script>

<template>
  <UButton
    icon="i-lucide-circle-play"
    :label="isMobile ? undefined : 'Slideshow'"
    color="neutral"
    variant="outline"
    size="sm"
    @click="isSetupVisible = true"
  />

  <DialogSlideshowSetup
    v-if="isSetupVisible"
    :is-visible="isSetupVisible"
    :title="content.title"
    @update:is-visible="isSetupVisible = $event"
    @start="start"
  />

  <DialogSlideshow
    v-if="isPlaying"
    :is-visible="isPlaying"
    :content="content"
    :is-set="isSet"
    :columns="options.columns"
    :randomize="options.randomize"
    :loops-per-content="options.loopsPerContent"
    @update:is-visible="isPlaying = $event"
  />
</template>
