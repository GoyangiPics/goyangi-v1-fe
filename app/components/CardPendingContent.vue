<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import { computed, ref } from 'vue'

/**
 * Stand-in card for a post with no renditions yet: still processing, or
 * failed. My uploads used to skip these in the grid while still counting
 * them, so a failed upload was invisible to the one person who could fix it.
 */
const props = defineProps<{ content: ContentsItem }>()
const emit = defineEmits<{ changed: [] }>()

const manageRef = ref<{ retryPost: () => Promise<void>; deletePost: () => Promise<void> } | null>(
  null,
)

const failed = computed(() => !!props.content.encodeError)
</script>

<template>
  <div
    class="surface-card p-3 flex flex-col gap-2"
    :class="failed ? 'ring-1 ring-red-500/40' : 'ring-1 ring-amber-500/30'"
  >
    <div
      class="aspect-video rounded-md bg-night-900 flex flex-col items-center justify-center gap-1.5 text-center px-3"
    >
      <UIcon
        :name="failed ? 'i-lucide-circle-x' : 'i-lucide-loader-circle'"
        class="text-2xl"
        :class="failed ? 'text-red-400' : 'text-amber-400 animate-spin'"
      />
      <span class="text-sm font-medium" :class="failed ? 'text-red-300' : 'text-amber-300'">
        {{ failed ? "Couldn't process" : 'Processing…' }}
      </span>
    </div>
    <p class="text-sm font-semibold text-night-100 truncate" :title="content.title">
      {{ content.title || content.filename || 'Untitled' }}
    </p>
    <div class="flex items-center gap-2">
      <span class="text-xs text-night-500 font-mono flex-1">{{
        formatShortDate(content.created)
      }}</span>
      <UButton
        v-if="failed"
        icon="i-lucide-refresh-cw"
        label="Retry"
        size="xs"
        color="warning"
        variant="soft"
        @click="manageRef?.retryPost()"
      />
      <UButton
        icon="i-lucide-trash-2"
        size="xs"
        color="error"
        variant="ghost"
        aria-label="Delete post"
        @click="manageRef?.deletePost()"
      />
    </div>

    <ManageActions
      ref="manageRef"
      :content="content"
      @changed="emit('changed')"
      @content-deleted="emit('changed')"
    />
  </div>
</template>
