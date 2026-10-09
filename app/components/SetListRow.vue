<script setup lang="ts">
import type { SetsItem, SetsUnifiedItem } from '~/types/appTypes'
import { computed } from 'vue'

/**
 * One set as a dense list row: checkbox, thumbnail strip, title, counts, and
 * per-row copy buttons.
 *
 * A separate component from ContentListRow rather than one generic row, matching
 * a codebase that already has six distinct Card* components for the same reason —
 * the fields, links and destinations differ enough that a shared one would be all
 * branches.
 */
const props = defineProps<{
  set: SetsItem | SetsUnifiedItem
  selected: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const { copyLinks } = useCopyLinks()

const clips = computed<any[]>(() => (props.set.expand as any)?.contents_via_set ?? [])

// A one-item set skips its own listing page — see setHref.
const href = computed(() => setHref(props.set))

const thumbs = computed(() => clips.value.slice(0, 4).map(contentThumbUrl).filter(Boolean))

const idols = computed<any[]>(() => (props.set.expand as any)?.idol ?? [])
const groups = computed<any[]>(() => (props.set.expand as any)?.group ?? [])

function urls(field: 'preview' | 'sd' | 'hd') {
  return clips.value.map((c) => shortLinks(c)[field]).filter((u): u is string => !!u)
}
</script>

<template>
  <div
    class="flex items-center gap-3 p-2.5 rounded-xl border transition-colors"
    :class="
      selected ? 'border-primary/40 bg-primary/5' : 'border-white/8 bg-white/2 hover:bg-white/4'
    "
  >
    <UCheckbox :model-value="selected" @update:model-value="emit('toggle')" />

    <!-- Thumbnail strip. contentThumbUrl rather than a bare `static`, which is
         best-effort server-side and absent on stickers. -->
    <div class="flex gap-1 shrink-0">
      <div
        v-for="(url, i) in thumbs"
        :key="i"
        class="w-10 h-10 rounded-md overflow-hidden bg-white/5"
      >
        <img :src="url" class="w-full h-full object-cover" alt="" />
      </div>
      <div
        v-if="!thumbs.length"
        class="w-10 h-10 rounded-md bg-white/5 flex items-center justify-center"
      >
        <UIcon name="i-lucide-image-off" class="text-night-600 text-xs" />
      </div>
    </div>

    <div class="min-w-0 flex-1">
      <NuxtLink :to="href" class="text-sm font-medium truncate block hover:underline">
        {{ set.title || set.id }}
      </NuxtLink>
      <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
        <span class="text-xs text-night-500 font-mono">
          {{ clips.length }} {{ clips.length === 1 ? 'post' : 'posts' }}
        </span>
        <UBadge
          v-for="idol in idols.slice(0, 3)"
          :key="idol.id"
          :label="idol.name"
          color="neutral"
          variant="soft"
          class="text-xs!"
        />
        <UBadge
          v-for="group in groups.slice(0, 2)"
          :key="group.id"
          :label="group.name"
          color="primary"
          variant="soft"
          class="text-xs!"
        />
        <span class="text-xs text-night-600 font-mono">
          {{ new Date(set.created).toLocaleDateString() }}
        </span>
      </div>
    </div>

    <div class="shrink-0 flex items-center gap-1">
      <UButton
        icon="i-simple-icons-discord"
        size="xs"
        color="neutral"
        variant="ghost"
        title="Copy preview links"
        @click="copyLinks(urls('preview'), 'Preview')"
      />
      <UButton
        icon="i-lucide-copy"
        size="xs"
        color="neutral"
        variant="ghost"
        title="Copy SD links"
        @click="copyLinks(urls('sd'), 'SD')"
      />
      <UButton
        icon="i-lucide-file-video"
        size="xs"
        color="neutral"
        variant="ghost"
        title="Copy HD links"
        @click="copyLinks(urls('hd'), 'HD')"
      />
      <slot name="actions" />
    </div>
  </div>
</template>
