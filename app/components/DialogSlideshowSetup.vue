<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  isVisible: boolean
  title: string
}>()

const emit = defineEmits<{
  'update:isVisible': [boolean]
  start: [{ columns: number; randomize: boolean; loopsPerContent: number }]
}>()

const columns = ref(1)
const randomize = ref(false)
const loopsPerContent = ref(1)

const columnOptions = [
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
]

const loopOptions = [
  { label: '1×', value: 1 },
  { label: '3×', value: 3 },
  { label: '5×', value: 5 },
]

function start() {
  emit('start', {
    columns: columns.value,
    randomize: randomize.value,
    loopsPerContent: loopsPerContent.value,
  })
  emit('update:isVisible', false)
}
</script>

<template>
  <UModal
    :open="isVisible"
    :ui="{ content: 'w-auto' }"
    @update:open="emit('update:isVisible', $event)"
  >
    <template #content>
      <div class="p-5 min-w-80">
        <div class="flex items-center gap-2 mb-1">
          <UIcon name="i-lucide-circle-play" class="text-violet-400" />
          <h2 class="text-lg font-semibold">Play slideshow</h2>
        </div>
        <p class="text-sm text-night-400 mb-5 truncate">
          {{ title }}
        </p>

        <div class="flex flex-col gap-5">
          <div>
            <label class="micro-label text-night-400 mb-2 block"> Columns </label>
            <UTabs
              v-model="columns"
              :content="false"
              :items="columnOptions"
              size="xs"
              class="w-full"
            />
          </div>

          <div>
            <label class="micro-label text-night-400 mb-2 block"> Loops per post </label>
            <UTabs
              v-model="loopsPerContent"
              :content="false"
              :items="loopOptions"
              size="xs"
              class="w-full"
            />
            <p class="text-xs text-night-500 mt-1">
              Gifs and videos play {{ loopsPerContent }}×. Pics show for {{ loopsPerContent * 4 }}s.
            </p>
          </div>

          <USwitch v-model="randomize" label="Shuffle" />

          <div class="flex gap-2 pt-1">
            <UButton
              label="Cancel"
              color="neutral"
              class="flex-1"
              @click="emit('update:isVisible', false)"
            />
            <UButton label="Start" icon="i-lucide-play" class="flex-1" @click="start" />
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
