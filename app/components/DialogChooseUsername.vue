<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * Asks a signed-in account with no name to pick one.
 *
 * Sign-up asks for a username now, and Discord accounts arrive named, but email
 * accounts made before that had none — and showed up blank on their collections
 * and links. The backend backfills those that have an uploader name; this is for
 * the rest. Not dismissible: it appears once, and one field answers it.
 *
 * Waits for the session refresh, so a name the backfill already gave the
 * account doesn't get asked for from a stale cached record.
 */
const toast = useToast()
const authStore = useAuthStore()

const isVisible = computed(
  () => authStore.isSessionFresh && !!authStore.user && !authStore.user.name?.trim(),
)

const name = ref('')
const isSubmitting = ref(false)

async function handleSave() {
  if (!name.value.trim() || isSubmitting.value) return
  isSubmitting.value = true
  try {
    await authStore.updateUsername(name.value)
    toast.add({ title: `Welcome, ${name.value.trim()}!`, color: 'success', duration: 3000 })
  } catch (error: any) {
    toast.add({
      title: "Couldn't save username",
      description: error?.response?.message || 'Try again.',
      color: 'error',
      duration: 4000,
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
    title="Choose a username"
    :ui="{ content: 'sm:max-w-sm' }"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <p class="text-night-400 text-sm">
          It's shown on your posts and collections. You can change it later in your profile.
        </p>
        <UInput
          v-model="name"
          placeholder="e.g. nabi"
          maxlength="100"
          autofocus
          @keydown.enter="handleSave"
        />
      </div>
    </template>

    <template #footer>
      <UButton
        label="Save"
        color="success"
        block
        :disabled="!name.trim()"
        :loading="isSubmitting"
        @click="handleSave"
      />
    </template>
  </UModal>
</template>
