<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import { computed, ref } from 'vue'

/**
 * A cropped media tile for the trial home pages: a fixed shape the parent
 * picks, filled edge to edge, linking to the post.
 *
 * Not a card. CardMedia keeps each post's own shape because a grid of cards
 * must never crop; a hero mosaic or an emote grid is the opposite case, where
 * the shape is the layout's and the media is cut to fit it.
 *
 * Gifs loop while on screen, as on cards. Videos never autoplay: they show their
 * poster with a play mark and a sound mark, since they are the longer clips with
 * audio and should never start making noise on a front page.
 */
const props = withDefaults(
  defineProps<{
    content: ContentsItem
    /** A CSS aspect-ratio. Ignored with `fill`. */
    aspect?: string
    /** Fill the parent's box instead of setting a shape — for bento grids. */
    fill?: boolean
    /** Where the tile links. The post's page by default. */
    to?: string
    rounded?: string
  }>(),
  { aspect: '1', fill: false, to: undefined, rounded: 'rounded-xl' },
)

const settingsStore = useSettingsStore()
const autoplay = computed(() => settingsStore.settings.dataSavingMode !== 'Enabled')

const { usePreviewImage, previewImageSrc, videoSources } = useContentSources(
  () => props.content,
  'grid',
)

const gifVideoRef = ref<HTMLVideoElement | null>(null)
useVideoVisibility(gifVideoRef, autoplay)

const href = computed(() => props.to ?? `/single/${props.content.id}`)
const alt = computed(() => contentAltText(props.content))
const poster = computed(() => props.content.static || undefined)
const still = computed(() => contentThumbUrl(props.content))
</script>

<template>
  <NuxtLink
    :to="href"
    class="group relative block overflow-hidden bg-night-900"
    :class="[rounded, fill ? 'h-full w-full' : '']"
    :style="fill ? undefined : { aspectRatio: aspect }"
  >
    <video
      v-if="content.filetype === 'gif' && !usePreviewImage"
      ref="gifVideoRef"
      :key="content.id"
      class="absolute inset-0 h-full w-full object-cover"
      muted
      loop
      playsinline
      preload="metadata"
      :poster="poster"
    >
      <source v-for="s in videoSources" :key="s.src" :src="s.src" :type="s.type" />
    </video>
    <img
      v-else-if="content.filetype === 'gif'"
      :key="content.id"
      class="absolute inset-0 h-full w-full object-cover"
      :src="previewImageSrc"
      :alt="alt"
      loading="lazy"
      decoding="async"
    />
    <img
      v-else-if="content.filetype === 'video'"
      :key="content.id"
      class="absolute inset-0 h-full w-full object-cover"
      :src="still"
      :alt="alt"
      loading="lazy"
      decoding="async"
    />
    <img
      v-else
      :key="content.id"
      class="absolute inset-0 h-full w-full object-cover"
      :src="content.original"
      :alt="alt"
      loading="lazy"
      decoding="async"
    />

    <template v-if="content.filetype === 'video'">
      <span class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          class="flex size-14 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform group-hover:scale-105"
        >
          <UIcon name="i-lucide-play" class="size-6 translate-x-px" />
        </span>
      </span>
      <span
        class="absolute right-2.5 top-2.5 flex items-center rounded-full bg-black/55 p-1.5 text-white pointer-events-none"
        aria-label="Has sound"
      >
        <UIcon name="i-lucide-volume-2" class="size-3.5" />
      </span>
    </template>

    <span
      class="absolute inset-0 ring-1 ring-inset ring-white/5 transition-colors group-hover:bg-white/3 pointer-events-none"
      :class="rounded"
    />
    <slot />
  </NuxtLink>
</template>
