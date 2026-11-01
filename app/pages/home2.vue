<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import { computed, ref, watch } from 'vue'
import { CONTENT_EXPAND } from '~/composables/useFetchItems'
import {
  curatedFilter,
  findTag,
  HOME_TOPICS,
  starredClause,
  tally,
  topicFilter,
} from '~/utils/homeCuration'

/**
 * Home trial 2 — one topic feed, Pinterest-style.
 *
 * No rows: a single masonry of curated posts, steered by a strip of topic chips.
 * Closest to today's home, minus the ingested flood. Visitors who follow nobody
 * get a nudge to pick some, and "Your idols" becomes the first chip once they do.
 */
useHead({ title: 'Home' })
// TEMP(dev): open to signed-out visitors for the home trials. Restore
// `definePageMeta({ middleware: ['auth'] })` before this reaches main.

const route = useRoute()
const router = useRouter()
const pb = usePocketBase()
const { ready, referenceStore, starsStore } = useHomeReady()
const openInFeed = useFeedHandoff()
const tags = computed(() => referenceStore.tags)

const PAGE_SIZE = 30

interface Chip {
  key: string
  label: string
  filter: () => string | null
}

/** Topics whose tag exists (filetype topics always do), behind "All". */
const chips = computed<Chip[]>(() => {
  const list: Chip[] = []
  if (starsStore.hasAny) {
    list.push({
      key: 'yours',
      label: 'Your idols',
      filter: () =>
        curatedFilter(tags.value, null, starredClause(starsStore.idolIds, starsStore.groupIds)),
    })
  }
  list.push({ key: 'all', label: 'All', filter: () => curatedFilter(tags.value, null) })
  for (const topic of HOME_TOPICS) {
    if (topic.tags && !topic.tags.some((name) => findTag(tags.value, name))) continue
    list.push({ key: topic.key, label: topic.label, filter: () => topicFilter(topic, tags.value) })
  }
  return list
})

/** `?topic=` so a chip survives a reload and back from a post. */
const activeKey = computed(() => {
  const wanted = String(route.query.topic ?? '')
  return chips.value.some((c) => c.key === wanted) ? wanted : (chips.value[0]?.key ?? 'all')
})

function selectTopic(key: string) {
  void router.replace({ query: key === chips.value[0]?.key ? {} : { topic: key } })
}

// ─── Feed ────────────────────────────────────────────────────────────────────

const items = ref<ContentsItem[]>([])
const page = ref(1)
const hasMore = ref(false)
const isLoading = ref(true)
const isLoadingMore = ref(false)
let generation = 0

async function load(reset: boolean) {
  const chip = chips.value.find((c) => c.key === activeKey.value)
  const filter = chip?.filter()
  const mine = ++generation
  if (reset) {
    page.value = 1
    isLoading.value = true
  } else {
    isLoadingMore.value = true
  }
  try {
    if (!filter) {
      items.value = []
      hasMore.value = false
      return
    }
    const result = await pb.collection('contents').getList<ContentsItem>(page.value, PAGE_SIZE, {
      filter,
      sort: '-created',
      expand: CONTENT_EXPAND,
      requestKey: 'home2-feed',
    })
    if (mine !== generation) return
    items.value = reset ? result.items : [...items.value, ...result.items]
    hasMore.value = result.page < result.totalPages
  } catch (err) {
    if (mine !== generation || (err as any)?.isAbort) return
    console.error('[home2] fetch error:', err)
  } finally {
    if (mine === generation) {
      isLoading.value = false
      isLoadingMore.value = false
    }
  }
}

function showMore() {
  page.value++
  void load(false)
}

watch(
  [ready, activeKey, () => starsStore.idolIds.length + starsStore.groupIds.length],
  () => {
    if (ready.value) void load(true)
  },
  { immediate: true },
)

const { colCount } = useResponsiveColumns()
const { columns } = useMasonry(items, colCount)

// ─── Welcome ─────────────────────────────────────────────────────────────────

const isStarsVisible = ref(false)

/** Groups on screen, offered as one-click follows to someone who follows nobody. */
const suggestedGroups = computed(() =>
  tally(items.value, (item) => item.expand?.group ?? []).slice(0, 8),
)
</script>

<template>
  <div class="flex flex-col gap-5 pt-2">
    <nav aria-label="Topics" class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      <button
        v-for="chip in chips"
        :key="chip.key"
        type="button"
        class="h-10 shrink-0 rounded-full px-5 text-[14px] font-semibold transition-colors"
        :class="
          chip.key === activeKey
            ? 'bg-pink-400 text-night-950'
            : 'border border-night-700 bg-night-900 text-night-200 hover:text-night-50'
        "
        :aria-pressed="chip.key === activeKey"
        @click="selectTopic(chip.key)"
      >
        {{ chip.label }}
      </button>
    </nav>

    <section
      v-if="ready && !starsStore.hasAny"
      aria-labelledby="home2-welcome"
      class="surface-card flex flex-wrap items-center gap-x-8 gap-y-4 px-6 py-5"
    >
      <div class="min-w-[260px] flex-1">
        <h1 id="home2-welcome" class="font-display text-[22px] font-semibold text-night-50">
          Make this page yours
        </h1>
        <p class="text-sm text-night-300">
          Follow a few groups and their posts get a chip of their own here.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          v-for="group in suggestedGroups"
          :key="group.id"
          :label="group.name"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          size="sm"
          @click="starsStore.toggleGroup(group.id)"
        />
        <UButton label="Pick idols" icon="i-lucide-star" @click="isStarsVisible = true" />
      </div>
    </section>

    <div v-if="isLoading" class="mt-16 flex justify-center">
      <LoadingSpinner />
    </div>
    <template v-else-if="items.length">
      <ContentGrid :columns="columns">
        <template #default="{ item }">
          <CardBaseContent :content="item" @filters-apply="openInFeed" @changed="load(true)" />
        </template>
      </ContentGrid>
      <div v-if="hasMore" class="flex justify-center">
        <UButton
          label="Show more"
          size="lg"
          color="neutral"
          variant="soft"
          :loading="isLoadingMore"
          @click="showMore"
        />
      </div>
    </template>
    <p v-else class="mt-16 text-center text-night-300">Nothing here yet.</p>

    <DialogManageStars
      v-if="isStarsVisible"
      :is-visible="isStarsVisible"
      @update:is-visible="isStarsVisible = $event"
    />
  </div>
</template>
