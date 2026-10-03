<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import { computed } from 'vue'

/** One content item as a dense list row. See SetListRow for why these are separate. */
const props = defineProps<{
  content: ContentsItem
  selected: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const { copyLink } = useCopyLinks()

const thumb = computed(() => contentThumbUrl(props.content))
const idols = computed<any[]>(() => (props.content.expand as any)?.idol ?? [])
const groups = computed<any[]>(() => (props.content.expand as any)?.group ?? [])
</script>

<template>
  <div
    class="flex items-center gap-3 p-2.5 rounded-xl border transition-colors"
    :class="
      selected ? 'border-primary/40 bg-primary/5' : 'border-white/8 bg-white/2 hover:bg-white/4'
    "
  >
    <UCheckbox :model-value="selected" @update:model-value="emit('toggle')" />

    <div class="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-white/5">
      <img v-if="thumb" :src="thumb" class="w-full h-full object-cover" alt="" />
    </div>

    <div class="min-w-0 flex-1">
      <NuxtLink
        :to="`/single/${content.id}`"
        class="text-sm font-medium truncate block hover:underline"
      >
        {{ content.title || content.id }}
      </NuxtLink>
      <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
        <UBadge
          v-if="content.filetype"
          :label="content.filetype"
          color="neutral"
          variant="subtle"
          class="text-xs!"
        />
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
          {{ new Date(content.created).toLocaleDateString() }}
        </span>
      </div>
    </div>

    <div class="shrink-0 flex items-center gap-1">
      <UButton
        v-if="content.preview"
        icon="i-simple-icons-discord"
        size="xs"
        color="neutral"
        variant="ghost"
        title="Copy preview link"
        @click="copyLink(content.preview, 'Preview')"
      />
      <UButton
        v-if="content.sd"
        icon="i-lucide-copy"
        size="xs"
        color="neutral"
        variant="ghost"
        title="Copy SD link"
        @click="copyLink(content.sd, 'SD')"
      />
      <UButton
        icon="i-lucide-file-video"
        size="xs"
        color="neutral"
        variant="ghost"
        title="Copy HD link"
        @click="copyLink(content.original, 'HD')"
      />
      <slot name="actions" />
    </div>
  </div>
</template>
