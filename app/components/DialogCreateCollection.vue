<script setup lang="ts">
import type { CollectionsItem } from '~/types/appTypes'
import { ref, watch } from 'vue'

/**
 * Create an empty collection, without needing a piece of content to hang it off.
 *
 * Previously the only way to make a collection was the right-click →
 * "Add To Collection" modal, which creates one and immediately puts something in
 * it. Deliberately offered only on /me/collections: the `savedCollections`
 * listing has no emptiness filter so a new collection appears there straight
 * away, whereas `allCollections` (the public /collections browse) filters empty
 * ones out — a create button there would let you watch it not appear.
 */
const props = defineProps<{
  isVisible: boolean
}>()

const emit = defineEmits<{
  'update:isVisible': [value: boolean]
  created: [collection: CollectionsItem]
}>()

const toast = useToast()
const { requireAuth } = useAuthGate()
const { isCreating, createCollection } = useCreateCollection()

const name = ref('')
const isPublic = ref(true)

// Reset on each open so a cancelled attempt doesn't prefill the next one.
watch(
  () => props.isVisible,
  (visible) => {
    if (visible) {
      name.value = ''
      isPublic.value = true
    }
  },
)

function close() {
  emit('update:isVisible', false)
}

async function handleCreate() {
  if (!requireAuth('create a collection')) return

  if (!name.value.trim()) {
    toast.add({
      title: 'Name required',
      description: 'Enter a name for the collection.',
      color: 'warning',
      duration: 2000,
    })
    return
  }

  try {
    const record = await createCollection(name.value, isPublic.value)
    emit('created', record)
    toast.add({
      title: 'Created!',
      description: `"${record.title}" is ready — add content to it from any card.`,
      color: 'success',
      duration: 3000,
    })
    close()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to create the collection.',
      color: 'error',
      duration: 3000,
    })
  }
}
</script>

<template>
  <UModal
    :open="isVisible"
    title="New collection"
    :ui="{ content: 'max-w-md' }"
    @update:open="emit('update:isVisible', $event)"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <UInput
          v-model="name"
          placeholder="Collection name..."
          autofocus
          class="w-full"
          @keydown.enter="handleCreate"
        />
        <div class="flex items-center justify-between">
          <USwitch v-model="isPublic" :label="isPublic ? 'Public' : 'Private'" />
          <p class="text-sm text-night-500">
            {{ isPublic ? 'Visible to everyone once it has content' : 'Only visible to you' }}
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-3 w-full">
        <UButton label="Cancel" color="neutral" block @click="close" />
        <UButton label="Create" color="success" block :loading="isCreating" @click="handleCreate" />
      </div>
    </template>
  </UModal>
</template>
