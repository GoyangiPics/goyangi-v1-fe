<script setup lang="ts">
import { onMounted, ref } from 'vue'

const pb = usePocketBase()
const toast = useToast()
const route = useRoute()

const tools = useImgurTools()
const { items, inputLinks, normalizeLinks, generateItems, linkLines, shareAsLink } = tools

// See tools/index.vue — same move, same reason.
const { colCount } = useResponsiveColumns()
const { columns } = useMasonry(items, colCount)

const recordId = ref<string | null>(null)
const isOwner = ref(false)
const linkTitle = ref<string>('')
const ownerName = ref<string>('')

async function updateLink() {
  if (!recordId.value) return
  normalizeLinks()
  try {
    await pb.collection('users_links').update(recordId.value, { links: linkLines() })
    toast.add({
      title: 'Updated!',
      description: 'Links updated successfully.',
      color: 'success',
      duration: 2000,
    })
  } catch (error) {
    console.error('Failed to update PocketBase record:', error)
    toast.add({ title: 'Update failed', color: 'error', duration: 2500 })
  }
}

async function fetchLinksById(id: string) {
  try {
    const record = await pb.collection('users_links').getOne(id, { expand: 'user' })
    recordId.value = record.id
    inputLinks.value = (record.links ?? []).join('\n')
    linkTitle.value = record.title ?? ''
    ownerName.value = displayName((record as any).expand?.user?.name)
    generateItems()
    isOwner.value = pb.authStore.record?.id === record.user
  } catch (error) {
    console.error('Failed to fetch PocketBase record:', error)
  }
}

async function saveTitle() {
  if (!recordId.value || !isOwner.value) return
  if (!linkTitle.value.trim()) linkTitle.value = 'Untitled'
  try {
    await pb.collection('users_links').update(recordId.value, {
      title: linkTitle.value.trim() || 'Untitled',
    })
  } catch (error) {
    console.error('Failed to update title:', error)
  }
}

onMounted(() => {
  const routeId = route.params.id
  if (routeId) fetchLinksById(routeId as string)
})
</script>

<template>
  <div>
    <div class="flex justify-start items-center">
      <NavigationBase class="mt-4 flex-1" />
    </div>

    <div class="mt-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-2xl leading-none">🛠️</span>
        <NuxtLink to="/tools" class="text-night-500 hover:text-night-300 text-sm transition-colors">
          Imgur Tools
        </NuxtLink>
        <UIcon name="i-lucide-chevron-right" class="text-xs text-night-600" />
        <input
          v-if="isOwner"
          v-model="linkTitle"
          type="text"
          placeholder="Untitled"
          class="link-title-input"
          @blur="saveTitle"
          @keyup.enter="($event.target as HTMLInputElement).blur()"
        />
        <h1 v-else class="text-xl font-semibold text-night-100 truncate">
          {{ linkTitle || 'Untitled' }}
        </h1>
        <span class="text-xs text-night-500 font-mono mt-0.5">
          {{ items.length }} {{ items.length === 1 ? 'link' : 'links' }}
        </span>
      </div>
      <p class="text-sm text-night-400 mb-4 max-w-2xl">
        <span v-if="isOwner" class="text-pink-300/80"
          >You own this — title and links auto-save.</span
        >
        <span v-else class="text-night-500">
          Shared by <span class="text-night-300">{{ ownerName || 'anon' }}</span> · read-only
        </span>
      </p>
    </div>

    <ToolsLinksPanel :tools="tools">
      <UButton
        v-if="recordId && isOwner"
        label="Update Link"
        icon="i-lucide-refresh-cw"
        class="search-gradient ml-auto"
        size="sm"
        @click="updateLink"
      />
      <UButton
        v-else
        label="Share Link"
        icon="i-lucide-share-2"
        class="search-gradient ml-auto"
        size="sm"
        @click="shareAsLink"
      />
    </ToolsLinksPanel>

    <ContentGrid v-if="items.length !== 0" :columns="columns">
      <template #default="{ item }">
        <CardToolsContent :content="item" @download-file="downloadFile" />
      </template>
    </ContentGrid>
    <div v-else class="flex flex-col items-center justify-center py-12 text-center">
      <UIcon name="i-lucide-images" class="text-5xl text-night-700 mb-3" />
      <p class="text-sm text-night-500">No links to preview yet.</p>
    </div>
  </div>
</template>

<style scoped>
.link-title-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 4px 8px;
  color: var(--color-night-100);
  font-size: 1.25rem;
  font-weight: 600;
  outline: none;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.link-title-input:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
}

.link-title-input:focus {
  background: rgba(0, 0, 0, 0.25);
  border-color: color-mix(in oklab, var(--color-pink-500), transparent 60%);
}
</style>
