<script setup lang="ts">
import type { ImgurItem } from '~/composables/useImgurTools'
import { computed, ref } from 'vue'

const props = defineProps<{
  content: ImgurItem
}>()

const emit = defineEmits(['downloadFile'])

const toast = useToast()

const settingsStore = useSettingsStore()

const contentUrl = computed(() => props.content.file)

const isFullscreenModalVisible = ref(false)
function contentOpen() {
  isFullscreenModalVisible.value = true
}

function isVideo(file: string) {
  return file && /\.mp4$/i.test(file)
}

function emitDownload() {
  emit('downloadFile', contentUrl.value)
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(contentUrl.value)
    toast.add({
      title: 'Copied!',
      description: 'Text copied to clipboard.',
      color: 'success',
      duration: 2000,
    })
  } catch (err) {
    console.error('Failed to copy text: ', err)
    toast.add({
      title: 'Error',
      description: 'Failed to copy text.',
      color: 'error',
      duration: 2000,
    })
  }
}
</script>

<template>
  <div>
    <div class="p-2.5 relative data-tilt surface-card">
      <div class="flex items-center gap-1 mb-2.5">
        <NuxtLink :to="`/single/${content.id}`" class="flex-1 truncate">
          <h3 class="hover:text-violet-400">
            {{ content.title }}
          </h3>
        </NuxtLink>
      </div>
      <div
        class="relative hover:brightness-110 transition duration-300"
        @click.stop.prevent="contentOpen"
      >
        <div v-if="isVideo(contentUrl)">
          <a :href="contentUrl">
            <video
              class="block w-full rounded-md"
              :autoplay="settingsStore.settings.dataSavingMode === 'Disabled'"
              muted
              loop
              width="250"
            >
              <source :src="contentUrl" type="video/mp4" />
            </video>

            <div
              v-if="settingsStore.settings.dataSavingMode === 'Enabled'"
              class="absolute top-0 left-0 w-full h-full flex items-center justify-center"
            >
              <UIcon name="i-lucide-circle-play" class="text-5xl! opacity-50" />
            </div>
          </a>
        </div>
        <div v-else>
          <a :href="contentUrl">
            <img class="rounded-md w-full" :src="contentUrl" alt="pic" />
          </a>
        </div>
        <div class="flex">
          <UButton
            color="neutral"
            variant="solid"
            label="Download"
            block
            class="mt-2"
            @click.stop.prevent="emitDownload"
          />
          <UButton
            color="neutral"
            variant="solid"
            label="Copy"
            block
            class="mt-2"
            @click.stop.prevent="copyLink"
          />
        </div>
      </div>
    </div>
  </div>

  <div v-if="isFullscreenModalVisible">
    <UModal
      v-model:open="isFullscreenModalVisible"
      :close="false"
      :ui="{ content: 'w-fit sm:max-w-[calc(100vw-2rem)]' }"
    >
      <template #body>
        <div class="max-h-[90vh] overflow-y-auto pt-5">
          <div v-if="isVideo(contentUrl)">
            <a :href="contentUrl">
              <video class="block w-full rounded-md" autoplay muted loop style="max-height: 85vh">
                <source :src="contentUrl" type="video/mp4" />
              </video>
            </a>
          </div>
          <div v-else>
            <a :href="contentUrl">
              <img class="rounded-md w-full" style="max-height: 85vh" :src="contentUrl" alt="pic" />
            </a>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
