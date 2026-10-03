<script setup lang="ts">
import type { Settings } from '~/types/typesSettings'
import { onMounted, ref } from 'vue'
import { DEFAULT_SETTINGS } from '~/stores/storeSettings'

defineProps({
  isVisible: Boolean,
})

const emit = defineEmits(['settingsApply', 'update:isVisible'])

const settingsStore = useSettingsStore()
// Seeded from the store's defaults, replaced by the persisted values on mount.
const settings = ref<Settings>({ ...DEFAULT_SETTINGS })

onMounted(() => {
  settings.value = JSON.parse(JSON.stringify(settingsStore.settings))
})

function optionsReset() {
  settingsStore.reset()
}

function optionsApply() {
  settingsStore.settings = settings.value
  settingsStore.settingsAppliedAt++
  handleHide()
}

function handleVisibilityChange(value: boolean) {
  emit('update:isVisible', value)
}

function handleHide() {
  emit('update:isVisible', false)
}
</script>

<template>
  <UModal
    :open="isVisible"
    title="Settings"
    :ui="{ content: 'sm:max-w-md' }"
    @update:open="handleVisibilityChange"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <span class="micro-label text-night-400">Max Column Count</span>
          <UTabs
            v-model="settings.columnCount"
            :content="false"
            :items="settingsStore.columnCountOptions.map((o) => ({ label: o, value: o }))"
            size="xs"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="micro-label text-night-400">Max Content Count</span>
          <UTabs
            v-model="settings.contentCount"
            :content="false"
            :items="settingsStore.contentCountOptions.map((o) => ({ label: o, value: o }))"
            size="xs"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="micro-label text-night-400">Playback Quality</span>
          <UTabs
            v-model="settings.contentFormat"
            :content="false"
            :items="settingsStore.contentFormatOptions.map((o) => ({ label: o, value: o }))"
            size="xs"
          />
          <span class="text-xs text-night-500">
            Applies to fullscreen and single view. Grid cards play SD or the lightweight preview.
          </span>
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="micro-label text-night-400">Data Saving Mode</span>
          <UTabs
            v-model="settings.dataSavingMode"
            :content="false"
            :items="settingsStore.dataSavingModeOptions.map((o) => ({ label: o, value: o }))"
            size="xs"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="micro-label text-night-400">Uniform Card Shape</span>
          <UTabs
            v-model="settings.uniformCardRatio"
            :content="false"
            :items="settingsStore.uniformCardRatioOptions.map((o) => ({ label: o, value: o }))"
            size="xs"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="micro-label text-night-400">No Distractions Mode</span>
          <UTabs
            v-model="settings.noDistractionMode"
            :content="false"
            :items="settingsStore.noDistractionModeOptions.map((o) => ({ label: o, value: o }))"
            size="xs"
          />
        </div>

        <USeparator class="my-1!" />

        <div class="flex gap-2">
          <UButton color="error" label="Reset" block variant="outline" @click="optionsReset" />
          <UButton color="success" label="Save & Apply" block @click="optionsApply" />
        </div>
      </div>
    </template>
  </UModal>
</template>
