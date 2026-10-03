<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'

withDefaults(
  defineProps<{
    title?: string
    message: string
    icon?: string
    confirmLabel?: string
    cancelLabel?: string
    /** Color of the confirm button — pass 'error' for destructive actions. */
    color?: ButtonProps['color']
  }>(),
  {
    title: 'Are you sure?',
    icon: undefined,
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    color: 'primary',
  },
)

defineEmits<{ close: [boolean] }>()
</script>

<template>
  <UModal :title="title" :close="false">
    <template #body>
      <div class="flex items-start gap-3">
        <UIcon v-if="icon" :name="icon" class="size-5 shrink-0 text-muted" />
        <p class="text-sm">{{ message }}</p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          :label="cancelLabel"
          @click="$emit('close', false)"
        />
        <UButton :color="color" :label="confirmLabel" @click="$emit('close', true)" />
      </div>
    </template>
  </UModal>
</template>
