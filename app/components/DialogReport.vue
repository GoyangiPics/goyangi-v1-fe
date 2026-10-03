<script setup lang="ts">
import { onMounted, ref } from 'vue'

const props = defineProps<{
  isVisible: boolean
  contentId: string
}>()

const emit = defineEmits(['update:isVisible'])

const pb = usePocketBase()
const authStore = useAuthStore()
const toast = useToast()

const reportTypes = [
  { label: 'Terms of Service violation', value: 'tos' },
  { label: 'Suggest metadata change', value: 'tags' },
  { label: 'Low quality content', value: 'quality' },
  { label: 'Other', value: 'other' },
]

const selectedType = ref<string | undefined>(undefined)
const message = ref('')
const isSubmitting = ref(false)
const alreadyReported = ref(false)

onMounted(async () => {
  const userId = authStore.user?.id
  if (!userId) return
  try {
    const result = await pb.collection('contents_reports').getList(1, 1, {
      filter: pb.filter('user = {:user} && content = {:content}', {
        user: userId,
        content: props.contentId,
      }),
    })
    alreadyReported.value = result.totalItems > 0
  } catch {
    // non-fatal — worst case user can attempt to submit and the server will reject
  }
})

async function submit() {
  if (!selectedType.value) return
  const userId = authStore.user?.id
  if (!userId) {
    toast.add({
      title: 'Not logged in',
      description: 'You must be logged in to report.',
      color: 'warning',
      duration: 2000,
    })
    return
  }

  isSubmitting.value = true
  try {
    await pb.collection('contents_reports').create({
      user: userId,
      content: props.contentId,
      type: selectedType.value,
      message: message.value.trim() || null,
    })
    alreadyReported.value = true
    toast.add({
      title: 'Reported',
      description: "Thank you. We'll review this content.",
      color: 'success',
      duration: 3000,
    })
    emit('update:isVisible', false)
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to submit report. Please try again.',
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
    title="Report"
    :ui="{ content: 'sm:max-w-sm' }"
    @update:open="emit('update:isVisible', $event)"
  >
    <template #body>
      <div v-if="alreadyReported" class="flex flex-col items-center gap-3 py-2 text-center">
        <UIcon name="i-lucide-circle-check" class="text-4xl text-green-500" />
        <p class="text-night-300">You've already reported this content.</p>
      </div>
      <div v-else class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <span class="micro-label text-night-400">Reason</span>
          <URadioGroup v-model="selectedType" :items="reportTypes" />
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="micro-label text-night-400"
            >Message <span class="normal-case font-normal">(optional)</span></span
          >
          <UTextarea
            v-model="message"
            :maxlength="255"
            :rows="3"
            placeholder="Describe the issue..."
            class="w-full"
            :ui="{ base: 'resize-none' }"
          />
          <span class="text-xs text-night-500 text-right">{{ message.length }}/255</span>
        </div>

        <UButton
          label="Submit Report"
          icon="i-lucide-flag"
          color="error"
          :disabled="!selectedType || isSubmitting"
          :loading="isSubmitting"
          block
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
