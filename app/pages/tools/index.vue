<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

useHead({ title: 'Tools' })

const pb = usePocketBase()
const toast = useToast()

const tools = useImgurTools()
const { items, shareAsLink } = tools

// Same grid every other listing uses, so the column-count setting means the same
// thing here. The CSS multi-column layout this replaces set a column WIDTH and let
// the browser fit as many as it could, so it could not honour the setting as a
// ceiling at all — on the widened layout it ran to more columns than asked for.
const { colCount } = useResponsiveColumns()
const { columns } = useMasonry(items, colCount)

const savedLinks = ref<any[]>([])
const currentUserId = computed(() => pb.authStore.record?.id ?? null)
const myLinks = computed(() => savedLinks.value.filter((l) => l.user === currentUserId.value))
const otherLinks = computed(() => savedLinks.value.filter((l) => l.user !== currentUserId.value))

async function fetchSavedLinks() {
  try {
    const records = await pb.collection('users_links').getList(1, 60, {
      sort: '-created',
      expand: 'user',
    })
    savedLinks.value = records.items
  } catch (error) {
    console.error('Failed to fetch saved links:', error)
  }
}

async function deleteSavedLink(id: string, e: Event) {
  e.stopPropagation()
  e.preventDefault()
  try {
    await pb.collection('users_links').delete(id)
    savedLinks.value = savedLinks.value.filter((l) => l.id !== id)
    toast.add({ title: 'Deleted', color: 'success', duration: 1500 })
  } catch (error) {
    console.error('Failed to delete:', error)
    toast.add({ title: 'Delete failed', color: 'error', duration: 2000 })
  }
}

onMounted(fetchSavedLinks)
</script>

<template>
  <div>
    <div class="flex justify-start items-center">
      <NavigationBase class="mt-4 flex-1" />
    </div>

    <div class="mt-4">
      <PageHeader
        emoji="🛠️"
        title="Imgur Tools"
        :total="items.length"
        :total-label="items.length === 1 ? 'link' : 'links'"
      />
      <p class="text-sm text-night-400 mb-4 max-w-2xl">
        Paste Imgur links to grid them out, recover content from dead links, mass-download files, or
        generate a shareable link.
      </p>
    </div>

    <ToolsLinksPanel :tools="tools">
      <UButton
        label="Share Link"
        icon="i-lucide-share-2"
        class="search-gradient ml-auto"
        size="sm"
        @click="shareAsLink"
      />
    </ToolsLinksPanel>

    <div v-if="savedLinks.length > 0" class="glass-card p-5 mb-6">
      <div v-if="myLinks.length > 0" class="mb-4">
        <div class="flex items-center gap-2 mb-3">
          <UIcon name="i-lucide-user" class="text-pink-300" />
          <h2 class="micro-label text-pink-300">Your links</h2>
          <span class="ml-auto text-sm text-night-500 font-mono">
            {{ myLinks.length }}
          </span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <NuxtLink
            v-for="link in myLinks"
            :key="link.id"
            :to="`/tools/${link.id}`"
            class="saved-link-card group"
          >
            <div class="flex-1 min-w-0">
              <p class="text-sm text-night-100 truncate font-medium">
                {{ link.title || 'Untitled' }}
              </p>
              <p class="text-sm text-night-500 font-mono mt-0.5">
                {{ link.links?.length ?? 0 }}
                {{ (link.links?.length ?? 0) === 1 ? 'link' : 'links' }} ·
                {{ formatShortDate(link.created) }}
              </p>
            </div>
            <button
              class="saved-link-delete"
              aria-label="Delete"
              @click="deleteSavedLink(link.id, $event)"
            >
              <UIcon name="i-lucide-trash-2" class="text-xs" />
            </button>
            <UIcon
              name="i-lucide-arrow-up-right"
              class="text-night-600 group-hover:text-pink-300 transition-colors"
            />
          </NuxtLink>
        </div>
      </div>

      <div v-if="otherLinks.length > 0">
        <div class="flex items-center gap-2 mb-3">
          <UIcon name="i-lucide-globe" class="text-night-400" />
          <h2 class="micro-label text-night-400">Shared by others</h2>
          <span class="ml-auto text-sm text-night-500 font-mono">
            {{ otherLinks.length }}
          </span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <NuxtLink
            v-for="link in otherLinks"
            :key="link.id"
            :to="`/tools/${link.id}`"
            class="saved-link-card group"
          >
            <div class="flex-1 min-w-0">
              <p class="text-sm text-night-100 truncate font-medium">
                {{ link.title || 'Untitled' }}
              </p>
              <p class="text-sm text-night-500 font-mono mt-0.5">
                {{ link.links?.length ?? 0 }}
                {{ (link.links?.length ?? 0) === 1 ? 'link' : 'links' }} ·
                {{ displayName(link.expand?.user?.name) || 'anon' }} ·
                {{ formatShortDate(link.created) }}
              </p>
            </div>
            <UIcon
              name="i-lucide-arrow-up-right"
              class="text-night-600 group-hover:text-pink-300 transition-colors"
            />
          </NuxtLink>
        </div>
      </div>
    </div>

    <ContentGrid v-if="items.length !== 0" :columns="columns">
      <template #default="{ item }">
        <CardToolsContent :content="item" @download-file="downloadFile" />
      </template>
    </ContentGrid>
    <div v-else class="flex flex-col items-center justify-center py-12 text-center">
      <UIcon name="i-lucide-images" class="text-5xl text-night-700 mb-3" />
      <p class="text-sm text-night-500">
        Paste links above and hit <span class="text-night-300">Generate Grid</span> to preview them
        here.
      </p>
    </div>
  </div>
</template>

<style scoped>
.saved-link-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.025);
  transition:
    border-color 0.2s,
    background 0.2s;
}

.saved-link-card:hover {
  border-color: color-mix(in oklab, var(--color-pink-500), transparent 70%);
  background: color-mix(in oklab, var(--color-pink-500), transparent 95%);
}

.saved-link-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.35);
  border: none;
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 0.2s,
    background 0.2s,
    color 0.2s;
}

.saved-link-card:hover .saved-link-delete {
  opacity: 1;
}

.saved-link-delete:hover {
  background: rgba(239, 68, 68, 0.15);
  color: rgb(252, 165, 165);
}
</style>
