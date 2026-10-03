<script setup lang="ts">
/**
 * The collection list + inline create form, on its own.
 *
 * Lifted out of QuickCollectionModal, which had grown a bulk mode on top of a
 * hundred lines of list-and-create markup. Selection is the only state the
 * parent owns — everything about *loading* and *creating* collections lives
 * here, which leaves the modal as a picker plus its save semantics.
 */
import { onMounted, ref } from 'vue'

const selected = defineModel<string[]>({ required: true })

const toast = useToast()

// Loads the whole list — this used to cap at 50 unpaginated, so older
// collections were unreachable.
const { collections, isLoading, fetchCollections: loadCollections, addLocal } = useMyCollections()

const isCreateOpen = ref(false)

// isCreating is owned by the composable, so the loading state stays in step
// with the request wherever a collection is created from.
const { isCreating, createCollection } = useCreateCollection()

const newCollection = ref({ name: '', isPublic: true })

onMounted(fetchCollections)

async function fetchCollections() {
  try {
    await loadCollections()
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to fetch collections.',
      color: 'error',
      duration: 3000,
    })
  }
}

function toggleCollection(id: string) {
  const idx = selected.value.indexOf(id)
  // Reassigned rather than spliced: the parent may hold this array behind a
  // computed, and a mutation in place would not read as a change.
  if (idx === -1) selected.value = [...selected.value, id]
  else selected.value = selected.value.filter((c) => c !== id)
}

async function handleCreate() {
  if (!newCollection.value.name.trim()) {
    toast.add({
      title: 'Name required',
      description: 'Enter a name for the collection.',
      color: 'warning',
      duration: 2000,
    })
    return
  }

  try {
    const record = await createCollection(newCollection.value.name, newCollection.value.isPublic)
    addLocal(record)
    selected.value = [...selected.value, record.id]
    newCollection.value = { name: '', isPublic: true }
    isCreateOpen.value = false
    toast.add({
      title: 'Created!',
      description: `"${record.title}" created and selected.`,
      color: 'success',
      duration: 2000,
    })
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to create collection.',
      color: 'error',
      duration: 3000,
    })
  }
}
</script>

<template>
  <div>
    <!-- Collection list -->
    <div class="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1 mb-4">
      <!-- Loading -->
      <template v-if="isLoading">
        <div v-for="i in 3" :key="i" class="h-12 rounded-lg bg-white/5 animate-pulse" />
      </template>

      <!-- Empty state -->
      <div
        v-else-if="!collections.length"
        class="flex flex-col items-center justify-center py-8 text-night-400"
      >
        <UIcon name="i-lucide-folder-open" class="text-3xl mb-2" />
        <p class="text-sm">No collections yet</p>
      </div>

      <!-- Items -->
      <template v-else>
        <div
          v-for="col in collections"
          :key="col.id"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors select-none"
          :class="
            selected.includes(col.id)
              ? 'bg-primary/15 border border-primary/40'
              : 'bg-white/5 border border-transparent hover:bg-white/10'
          "
          @click="toggleCollection(col.id)"
        >
          <UCheckbox :model-value="selected.includes(col.id)" class="pointer-events-none" />
          <span class="flex-1 text-sm font-medium truncate">{{ col.title }}</span>
          <UBadge
            :label="col.isPublic ? 'Public' : 'Private'"
            :color="col.isPublic ? 'info' : 'neutral'"
            variant="soft"
            class="text-xs shrink-0"
          />
        </div>
      </template>
    </div>

    <!-- Inline create form -->
    <div class="border border-white/10 rounded-lg overflow-hidden">
      <button
        class="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-night-300 hover:text-white hover:bg-white/5 transition-colors"
        @click="isCreateOpen = !isCreateOpen"
      >
        <UIcon
          :name="isCreateOpen ? 'i-lucide-chevron-down' : 'i-lucide-plus'"
          class="text-xs transition-transform duration-200"
        />
        New collection
      </button>

      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 max-h-0"
        enter-to-class="opacity-100 max-h-40"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 max-h-40"
        leave-to-class="opacity-0 max-h-0"
      >
        <div v-if="isCreateOpen" class="px-3 pb-3 flex flex-col gap-2 border-t border-white/10">
          <UInput
            v-model="newCollection.name"
            placeholder="Collection name..."
            class="mt-3 w-full"
            autofocus
            @keydown.enter="handleCreate"
            @keydown.esc="isCreateOpen = false"
          />
          <div class="flex items-center justify-between">
            <USwitch
              v-model="newCollection.isPublic"
              :label="newCollection.isPublic ? 'Public' : 'Private'"
            />
            <UButton
              label="Create"
              color="success"
              size="sm"
              :loading="isCreating"
              @click="handleCreate"
            />
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>
