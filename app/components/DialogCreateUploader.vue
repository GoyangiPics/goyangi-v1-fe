<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  isVisible: boolean
}>()

const emit = defineEmits(['update:isVisible', 'created'])

// dismissible=false also swallows Esc; the old PrimeVue dialog always
// closed on Esc (only backdrop-click was blocked), so restore that path.
defineShortcuts({
  escape: {
    usingInput: true,
    handler: () => {
      if (props.isVisible) emit('update:isVisible', false)
    },
  },
})

const toast = useToast()
const authStore = useAuthStore()

const name = ref('')
const isSubmitting = ref(false)

async function handleCreate() {
  if (!name.value.trim()) return

  isSubmitting.value = true
  try {
    await authStore.createUploader(name.value)
    toast.add({
      title: `Welcome, ${name.value.trim()}!`,
      color: 'success',
      duration: 3000,
    })
    emit('created')
    emit('update:isVisible', false)
  } catch {
    toast.add({
      title: "Couldn't create uploader",
      description: 'Try again.',
      color: 'error',
      duration: 3000,
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal
    :open="isVisible"
    :close="false"
    :dismissible="false"
    title="Choose your uploader name"
    :ui="{ content: 'sm:max-w-sm' }"
    @update:open="emit('update:isVisible', $event)"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <p class="text-night-400 text-sm">This name is shown on everything you upload.</p>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-night-400">Display name</label>
          <UInput
            v-model="name"
            placeholder="e.g. nabi, fansite_name…"
            autofocus
            @keydown.enter="handleCreate"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <UButton
        label="Save"
        color="success"
        block
        :disabled="!name.trim()"
        :loading="isSubmitting"
        @click="handleCreate"
      />
    </template>
  </UModal>
</template>
