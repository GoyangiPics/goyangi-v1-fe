<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import { computed, onMounted, ref } from 'vue'

useHead({ title: 'Admin' })

definePageMeta({
  middleware: ['auth', 'admin'],
})

/**
 * Moderation in one place: what people reported, what never finished
 * processing, and which uploaders the Discord bot should leave alone.
 *
 * Each tab is its own component and loads when it's opened. The counts on the
 * tab labels come from two count queries here, so they show before their tab
 * does; a tab reports its own count back once it has loaded or changed.
 */
const pb = usePocketBase()

/** A post with no preview this long after upload is stuck or failed, not just slow. */
const STUCK_MINUTES = 30

const tab = ref('reports')
const reportCount = ref(0)
const attentionCount = ref(0)

async function loadCounts() {
  const before = new Date(Date.now() - STUCK_MINUTES * 60_000)
  try {
    const [reports, attention] = await Promise.all([
      pb.collection('contents_reports').getList(1, 1, { fields: 'id', requestKey: null }),
      pb.collection('contents').getList(1, 1, {
        filter: pb.filter("preview = '' && created < {:before}", { before }),
        fields: 'id',
        requestKey: null,
      }),
    ])
    reportCount.value = reports.totalItems
    attentionCount.value = attention.totalItems
  } catch (e: any) {
    if (!e?.isAbort) console.error('Failed to load admin counts:', e)
  }
}

const items = computed<TabsItem[]>(() => [
  {
    label: 'Reports',
    icon: 'i-lucide-flag',
    value: 'reports',
    slot: 'reports',
    badge: reportCount.value || undefined,
  },
  {
    label: 'Needs attention',
    icon: 'i-lucide-triangle-alert',
    value: 'attention',
    slot: 'attention',
    badge: attentionCount.value || undefined,
  },
  { label: 'Uploaders', icon: 'i-lucide-users', value: 'uploaders', slot: 'uploaders' },
])

onMounted(loadCounts)
</script>

<template>
  <div>
    <NavigationBase class="my-4" />

    <PageHeader icon="i-lucide-shield" title="Admin" />

    <UTabs v-model="tab" :items="items" variant="link" class="w-full" :ui="{ content: 'pt-4' }">
      <template #reports>
        <AdminReports @count="reportCount = $event" />
      </template>
      <template #attention>
        <AdminNeedsAttention :stuck-minutes="STUCK_MINUTES" @count="attentionCount = $event" />
      </template>
      <template #uploaders>
        <AdminUploaders />
      </template>
    </UTabs>
  </div>
</template>
