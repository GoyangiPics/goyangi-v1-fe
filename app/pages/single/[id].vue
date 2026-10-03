<script setup lang="ts">
import { onMounted } from 'vue'

// TEMPORARILY PUBLIC: a shared single-content link opens without an account,
// same as /set/[id]. The auth-only actions here (like, report) prompt for
// login instead — see useAuthGate().
// Restore with: definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const pb = usePocketBase()

const itemId = route.params.id as string
const { item, fetchItem } = useFetchItem(itemId)

useDetailSeo({
  type: 'single',
  id: itemId,
  // The item's own title, which is what a shared link should be headed by.
  // Falls back to "idols · groups" only when there is no title at all — for
  // Discord-ingested content the title is itself derived as "Idols - Groups"
  // (see bot/metadata.go), so that path is mostly for site uploads left untitled.
  title: (d) => {
    const own = d?.title?.trim()
    if (own) return own
    const parts: string[] = []
    if (d?.idols?.length) parts.push(d.idols.join(', '))
    if (d?.groups?.length) parts.push(d.groups.join(', '))
    return parts.join(' · ') || 'Goyangi'
  },
  description: (d) => {
    const parts: string[] = []
    if (d?.likes !== undefined) parts.push(`❤️ ${d.likes}`)
    if (d?.uploader) parts.push(`uploaded by ${d.uploader}`)
    return parts.join(' · ') || 'Goyangi'
  },
  fetchOg: async () => {
    try {
      const record = await pb.collection('contents').getOne(itemId, {
        expand: 'uploader,uploader.user,idol,group',
      })
      const ex = record.expand as any
      return {
        title: (record.title as string) ?? '',
        preview: (record.preview as string) ?? '',
        original: (record.original as string) ?? '',
        sd: (record.sd as string) ?? '',
        filetype: (record.filetype as string) ?? '',
        uploader: ex?.uploader?.name ?? '',
        likes: (record.likes as any[])?.length ?? 0,
        idols: (ex?.idol ?? []).map((i: any) => i.name).filter(Boolean) as string[],
        groups: (ex?.group ?? []).map((g: any) => g.name).filter(Boolean) as string[],
      }
    } catch {
      return {
        title: '',
        preview: '',
        original: '',
        sd: '',
        filetype: '',
        uploader: '',
        likes: 0,
        idols: [],
        groups: [],
      }
    }
  },
})

// onMounted, so a server render (this route is SSR'd) never counts a crawler.
const { views, register } = useViewCounter('content', itemId)

onMounted(async () => {
  await fetchItem()
  register((item.value as any)?.views)
})
</script>

<template>
  <div>
    <NavigationBase class="my-4" />

    <!-- Capped and centred: the media column is fluid, and past ~6xl a portrait
         still stretches to a size no browser is going to render kindly. -->
    <div class="flex justify-center">
      <div class="w-full max-w-6xl">
        <CardSingleContent v-if="item" :content="item" :views="views" @changed="fetchItem()" />
        <div v-else class="flex justify-center items-center min-h-dvh">
          <LoadingSpinner />
        </div>
      </div>
    </div>
  </div>
</template>
