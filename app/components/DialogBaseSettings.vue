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

// The stored values double as the store's option labels (see storeSettings), so
// renaming them there would orphan persisted choices. Friendlier names are
// mapped here, for display only.
const OPTION_LABELS: Record<string, string> = {
  'HD MP4 (AV1)': 'HD',
  'SD MP4 (H264)': 'SD',
  'LD WebP': 'Preview',
  Disabled: 'Off',
  Enabled: 'On',
}

function toTabItems(options: readonly string[]) {
  return options.map((o) => ({ label: OPTION_LABELS[o] ?? o, value: o }))
}

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
          <span class="micro-label text-night-400">Max columns</span>
          <UTabs
            v-model="settings.columnCount"
            :content="false"
            :items="settingsStore.columnCountOptions.map((o) => ({ label: o, value: o }))"
            size="xs"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="micro-label text-night-400">Posts per page</span>
          <UTabs
            v-model="settings.contentCount"
            :content="false"
            :items="settingsStore.contentCountOptions.map((o) => ({ label: o, value: o }))"
            size="xs"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="micro-label text-night-400">Video quality</span>
          <UTabs
            v-model="settings.contentFormat"
            :content="false"
            :items="toTabItems(settingsStore.contentFormatOptions)"
            size="xs"
          />
          <span class="text-xs text-night-500">
            For fullscreen and single posts. HD looks best. SD loads faster and plays on older
            devices. Preview uses the least data.
          </span>
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="micro-label text-night-400">Data saver</span>
          <UTabs
            v-model="settings.dataSavingMode"
            :content="false"
            :items="toTabItems(settingsStore.dataSavingModeOptions)"
            size="xs"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="micro-label text-night-400">Same-shape cards</span>
          <UTabs
            v-model="settings.uniformCardRatio"
            :content="false"
            :items="toTabItems(settingsStore.uniformCardRatioOptions)"
            size="xs"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="micro-label text-night-400">No distractions</span>
          <UTabs
            v-model="settings.noDistractionMode"
            :content="false"
            :items="toTabItems(settingsStore.noDistractionModeOptions)"
            size="xs"
          />
        </div>

        <USeparator class="my-1!" />

        <div class="flex gap-2">
          <UButton color="error" label="Reset" block variant="outline" @click="optionsReset" />
          <UButton color="success" label="Save" block @click="optionsApply" />
        </div>
      </div>
    </template>
  </UModal>
</template>
