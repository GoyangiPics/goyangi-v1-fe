<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { ref } from 'vue'

const props = defineProps<{
  title: string
  isPublic: boolean
}>()

const emit = defineEmits<{
  save: [{ title: string; isPublic: boolean }]
  delete: [Event]
}>()

const editOpen = ref(false)
const editTitle = ref('')
const editIsPublic = ref(true)

// Opening from the wrench menu's onSelect races Reka's dismiss layer — the
// guard swallows the menu-close interaction so the panel stays open.
const dismissGuard = usePopoverDismissGuard(editOpen)

const items: DropdownMenuItem[] = [
  {
    label: 'Edit',
    icon: 'i-lucide-pencil',
    onSelect: () => {
      editTitle.value = props.title
      editIsPublic.value = props.isPublic
      editOpen.value = true
    },
  },
  {
    label: 'Delete',
    icon: 'i-lucide-trash-2',
    onSelect: (e: Event) => emit('delete', e),
  },
]

function handleSave() {
  if (!editTitle.value.trim()) return
  emit('save', { title: editTitle.value.trim(), isPublic: editIsPublic.value })
  editOpen.value = false
}
</script>

<template>
  <!-- The edit panel anchors to the wrench menu; the menu's "Edit" item opens
       it. The dismiss guard in :content keeps the panel from being closed by
       the same interaction that closed the menu. -->
  <UPopover
    v-model:open="editOpen"
    :content="{ side: 'bottom', align: 'end', collisionPadding: 8, ...dismissGuard }"
  >
    <template #anchor>
      <WrenchSpeedDial :model="items" />
    </template>
    <template #content>
      <div class="flex flex-col gap-3 p-3" style="width: 220px">
        <UInput
          v-model="editTitle"
          placeholder="Collection name"
          size="sm"
          class="w-full"
          autofocus
          @keydown.enter="handleSave"
          @keydown.esc="editOpen = false"
        />
        <USwitch
          v-model="editIsPublic"
          :label="editIsPublic ? 'Public' : 'Private'"
          :ui="{ label: 'font-normal text-night-300 cursor-pointer select-none' }"
        />
        <div class="flex gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            size="sm"
            block
            @click="
              () => {
                editOpen = false
              }
            "
          />
          <UButton label="Save" color="success" size="sm" block @click="handleSave" />
        </div>
      </div>
    </template>
  </UPopover>
</template>
