<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { ref } from 'vue'

defineProps<{
  content: any
}>()

const emit = defineEmits<{
  delete: [Event]
  saved: []
}>()

const isEditPopoverOpen = ref(false)

// Opening from the wrench menu's onSelect races Reka's dismiss layer — the
// guard swallows the menu-close interaction so the panel stays open.
const dismissGuard = usePopoverDismissGuard(isEditPopoverOpen)

const items: DropdownMenuItem[] = [
  {
    label: 'Edit',
    icon: 'i-lucide-pencil',
    // No field seeding here any more: ContentEditForm reads the record on
    // mount, and the popover only mounts its content while open.
    onSelect: () => {
      isEditPopoverOpen.value = true
    },
  },
  {
    label: 'Delete',
    icon: 'i-lucide-trash-2',
    onSelect: (e: Event) => emit('delete', e),
  },
]

function onSaved() {
  isEditPopoverOpen.value = false
  emit('saved')
}
</script>

<template>
  <!-- The edit panel anchors to the wrench menu; the menu's "Edit" item opens
       it. The dismiss guard in :content keeps the panel from being closed by
       the same interaction that closed the menu. -->
  <UPopover
    v-model:open="isEditPopoverOpen"
    :content="{ side: 'bottom', align: 'end', collisionPadding: 8, ...dismissGuard }"
  >
    <template #anchor>
      <WrenchSpeedDial :model="items" />
    </template>
    <template #content>
      <div class="p-4" style="width: 320px">
        <ContentEditForm :content="content" @saved="onSaved" @cancel="isEditPopoverOpen = false" />
      </div>
    </template>
  </UPopover>
</template>
