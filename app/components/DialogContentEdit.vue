<script setup lang="ts">
/**
 * ContentEditForm in a modal, for surfaces with nothing to anchor a popover to.
 *
 * The uploads page hangs the same form off its wrench button; a card's admin
 * context menu closes the instant it is used, so there is no anchor left to
 * attach to and the edit has to become its own layer.
 */
defineProps<{
  isVisible: boolean
  content: any
}>()

const emit = defineEmits<{
  'update:isVisible': [value: boolean]
  saved: []
}>()

function onSaved() {
  emit('saved')
  emit('update:isVisible', false)
}
</script>

<template>
  <UModal
    :open="isVisible"
    title="Edit post"
    :ui="{ content: 'sm:max-w-lg' }"
    @update:open="emit('update:isVisible', $event)"
  >
    <template #body>
      <ContentEditForm
        :content="content"
        @saved="onSaved"
        @cancel="emit('update:isVisible', false)"
      />
    </template>
  </UModal>
</template>
