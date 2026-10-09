<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import { ref } from 'vue'

/** Add the selected posts to one or more of your collections. */
const props = defineProps<{
  isVisible: boolean
  posts: ContentsItem[]
}>()

const emit = defineEmits<{ 'update:isVisible': [value: boolean] }>()

const { addAllItems, isAddingAll } = useAddAllToCollection()
const selected = ref<string[]>([])

async function add() {
  const result = await addAllItems(props.posts, selected.value)
  if (result && !result.failed) emit('update:isVisible', false)
}
</script>

<template>
  <UModal
    :open="isVisible"
    :title="`Add ${posts.length} post${posts.length === 1 ? '' : 's'} to a collection`"
    :ui="{ content: 'sm:max-w-md' }"
    @update:open="emit('update:isVisible', $event)"
  >
    <template #body>
      <div class="flex flex-col gap-3">
        <CollectionPicker v-model="selected" />
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="emit('update:isVisible', false)"
          />
          <UButton
            label="Add"
            icon="i-lucide-folder-plus"
            :disabled="!selected.length"
            :loading="isAddingAll"
            @click="add"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
