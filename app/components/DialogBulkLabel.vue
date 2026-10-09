<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import { ref, watch } from 'vue'

/** Put one label on every selected post. Labels are shared; anyone can add them. */
const props = defineProps<{
  isVisible: boolean
  posts: ContentsItem[]
}>()

const emit = defineEmits<{ 'update:isVisible': [value: boolean] }>()

const { searchLabels, applyLabel } = useLabels()
const { run } = useBulkAction()
const name = ref('')
const suggestions = ref<{ id: string; name: string }[]>([])
const isApplying = ref(false)

let timer: ReturnType<typeof setTimeout> | null = null
watch(name, (term) => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(async () => {
    suggestions.value = term.trim() ? await searchLabels(term.trim(), 8) : []
  }, 200)
})

async function apply() {
  const label = name.value.trim()
  if (!label) return
  isApplying.value = true
  try {
    const result = await run({
      items: props.posts,
      action: (post) => applyLabel(post.id, label),
      progress: 'Adding label…',
      success: (n) => `Labelled ${n} post${n === 1 ? '' : 's'}`,
      failure: "Couldn't add label",
    })
    if (!result.failed.length) emit('update:isVisible', false)
  } finally {
    isApplying.value = false
  }
}
</script>

<template>
  <UModal
    :open="isVisible"
    :title="`Label ${posts.length} post${posts.length === 1 ? '' : 's'}`"
    :ui="{ content: 'sm:max-w-md' }"
    @update:open="emit('update:isVisible', $event)"
  >
    <template #body>
      <div class="flex flex-col gap-3">
        <UInput
          v-model="name"
          placeholder="Label, e.g. mirror selca"
          icon="i-lucide-tag"
          autofocus
          @keydown.enter="apply"
        />
        <div v-if="suggestions.length" class="flex flex-wrap gap-1.5">
          <UBadge
            v-for="s in suggestions"
            :key="s.id"
            :label="s.name"
            color="primary"
            variant="outline"
            class="cursor-pointer select-none"
            @click="name = s.name"
          />
        </div>
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="emit('update:isVisible', false)"
          />
          <UButton
            label="Add label"
            :disabled="!name.trim()"
            :loading="isApplying"
            @click="apply"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
