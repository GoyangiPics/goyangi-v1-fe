<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import type { ContentsReportsResponse, UsersResponse } from '~/types/pocketbase-types'
import { computed, nextTick, onMounted, ref } from 'vue'

/**
 * Every open report, grouped by post, newest first. A post reported five times
 * is one decision, not five.
 *
 * Reports have no "resolved" state: dismissing deletes them, and deleting the
 * post deletes them with it (the backend cascades).
 */
const emit = defineEmits<{
  /** Open reports, for the tab label. */
  count: [n: number]
}>()

type Report = ContentsReportsResponse<{ content?: ContentsItem; user?: UsersResponse }>

interface ReportGroup {
  post: ContentsItem
  /** Newest first, as loaded. */
  reports: Report[]
  reasons: { type: string; label: string; color: 'error' | 'warning' | 'neutral'; count: number }[]
}

const REASONS: Record<string, { label: string; color: 'error' | 'warning' | 'neutral' }> = {
  tos: { label: 'Terms', color: 'error' },
  tags: { label: 'Wrong info', color: 'warning' },
  quality: { label: 'Low quality', color: 'neutral' },
  other: { label: 'Other', color: 'neutral' },
}

const pb = usePocketBase()
const { run } = useBulkAction()

const reports = ref<Report[]>([])
const isLoading = ref(true)

async function load() {
  isLoading.value = true
  try {
    reports.value = await pb.collection('contents_reports').getFullList<Report>({
      sort: '-created',
      expand: 'content,content.uploader,user',
      requestKey: 'admin_reports',
    })
    emit('count', reports.value.length)
  } catch (e: any) {
    if (!e?.isAbort) console.error('Failed to load reports:', e)
  } finally {
    isLoading.value = false
  }
}

// Sorted newest first, so each group lands where its newest report is.
const groups = computed<ReportGroup[]>(() => {
  const byPost = new Map<string, ReportGroup>()
  for (const report of reports.value) {
    const post = report.expand?.content
    if (!post) continue
    let group = byPost.get(post.id)
    if (!group) {
      group = { post, reports: [], reasons: [] }
      byPost.set(post.id, group)
    }
    group.reports.push(report)
  }
  for (const group of byPost.values()) {
    const counts = new Map<string, number>()
    for (const r of group.reports) counts.set(r.type, (counts.get(r.type) ?? 0) + 1)
    group.reasons = [...counts].map(([type, count]) => ({
      type,
      label: REASONS[type]?.label ?? type,
      color: REASONS[type]?.color ?? 'neutral',
      count,
    }))
  }
  return [...byPost.values()]
})

function dropReports(ids: Set<string>) {
  reports.value = reports.value.filter((r) => !ids.has(r.id))
  emit('count', reports.value.length)
}

// ─── Actions ─────────────────────────────────────────────────────────────────
// One ManageActions, pointed at whichever post was acted on: its dialogs are
// modal, so only one post is ever being edited or deleted at a time.

const manageRef = ref<{ editPost: () => void; deletePost: () => Promise<void> } | null>(null)
const activePost = ref<ContentsItem | null>(null)

async function withPost(post: ContentsItem, action: 'editPost' | 'deletePost') {
  activePost.value = post
  // ManageActions reads its `content` prop, which updates on the next render.
  await nextTick()
  await manageRef.value?.[action]()
}

function onPostDeleted() {
  const id = activePost.value?.id
  if (!id) return
  dropReports(new Set(reports.value.filter((r) => r.content === id).map((r) => r.id)))
  activePost.value = null
}

async function dismiss(group: ReportGroup) {
  const result = await run({
    items: group.reports,
    action: (r) => pb.collection('contents_reports').delete(r.id, { requestKey: null }),
    progress: 'Dismissing reports…',
    success: (n) => `Dismissed ${n} report${n === 1 ? '' : 's'}`,
    failure: "Couldn't dismiss reports",
  })
  dropReports(new Set(result.done.map((r) => r.id)))
}

onMounted(load)
</script>

<template>
  <div>
    <div v-if="isLoading" class="flex justify-center items-center mt-16">
      <LoadingSpinner />
    </div>

    <div v-else-if="!groups.length" class="flex justify-center items-center mt-16">
      <h1 class="text-2xl text-night-400">No open reports.</h1>
    </div>

    <div v-else class="flex flex-col gap-3">
      <div
        v-for="group in groups"
        :key="group.post.id"
        class="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-white/8 bg-white/2"
      >
        <NuxtLink
          :to="`/single/${group.post.id}`"
          class="w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center"
        >
          <img
            v-if="contentThumbUrl(group.post)"
            :src="contentThumbUrl(group.post)"
            class="w-full h-full object-cover"
            alt=""
          />
          <UIcon v-else name="i-lucide-image-off" class="text-night-500 text-xl" />
        </NuxtLink>

        <div class="min-w-0 flex-1 flex flex-col gap-2">
          <div class="min-w-0">
            <NuxtLink
              :to="`/single/${group.post.id}`"
              class="text-sm font-semibold truncate block hover:underline"
            >
              {{ group.post.title || group.post.id }}
            </NuxtLink>
            <p class="text-xs text-night-500">
              by {{ group.post.expand?.uploader?.name || 'unknown uploader' }}
            </p>
          </div>

          <div class="flex flex-wrap gap-1.5">
            <UBadge
              v-for="reason in group.reasons"
              :key="reason.type"
              :label="reason.count > 1 ? `${reason.label} ×${reason.count}` : reason.label"
              :color="reason.color"
              variant="soft"
              class="text-xs!"
            />
          </div>

          <ul class="flex flex-col gap-1">
            <li v-for="report in group.reports" :key="report.id" class="text-xs text-night-300">
              <span class="text-night-500 font-mono">{{ formatShortDate(report.created) }}</span>
              <span class="text-night-400">
                · {{ displayName(report.expand?.user?.name) || 'Someone' }}:
              </span>
              <span v-if="report.message">{{ report.message }}</span>
              <span v-else class="italic text-night-500">no message</span>
            </li>
          </ul>
        </div>

        <div class="flex sm:flex-col gap-2 shrink-0">
          <UButton
            icon="i-lucide-external-link"
            label="Open"
            size="xs"
            color="neutral"
            variant="outline"
            :to="`/single/${group.post.id}`"
          />
          <UButton
            icon="i-lucide-pencil"
            label="Edit"
            size="xs"
            color="neutral"
            variant="outline"
            @click="withPost(group.post, 'editPost')"
          />
          <UButton
            icon="i-lucide-trash-2"
            label="Delete post"
            size="xs"
            color="error"
            variant="soft"
            @click="withPost(group.post, 'deletePost')"
          />
          <UButton
            icon="i-lucide-check"
            label="Dismiss"
            size="xs"
            color="primary"
            variant="soft"
            @click="dismiss(group)"
          />
        </div>
      </div>
    </div>

    <ManageActions
      ref="manageRef"
      :content="activePost"
      @changed="load"
      @content-deleted="onPostDeleted"
    />
  </div>
</template>
