<script setup lang="ts">
import type { CollectionsItem, ContentsItem } from '~/types/appTypes'
import type { Tally } from '~/utils/homeCuration'
import { computed, ref, watch } from 'vue'
import { createdSince, curatedFilter, tally } from '~/utils/homeCuration'
import { shortLink } from '~/utils/shortLink'

/**
 * Home trial 4 — daily spotlight, Imgur-style.
 *
 * One gif of the day up top, then the best of the day, week or month ranked by
 * likes, with a sidebar of what's popular and who's uploading. Gives a reason to
 * come back daily and puts uploaders in view.
 */
useHead({ title: 'Home' })
// TEMP(dev): open to signed-out visitors for the home trials. Restore
// `definePageMeta({ middleware: ['auth'] })` before this reaches main.

const pb = usePocketBase()
const { ready, referenceStore } = useHomeReady()
const { copyLink } = useCopyLinks()
const openInFeed = useFeedHandoff()
const tags = computed(() => referenceStore.tags)

// ─── Gif of the day ──────────────────────────────────────────────────────────

/** The most liked gif of the last day, or of the last few on a quiet one. */
const spotlight = useContentShelf('h4-spotlight', () =>
  ready.value
    ? {
        filters: [1, 3, 7, 30].map((d) => curatedFilter(tags.value, 'gif', createdSince(d))),
        sort: '-likes:length,-created',
        limit: 1,
      }
    : null,
)
const gifOfTheDay = computed(() => spotlight.items.value[0])

const today = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

// ─── Best of ─────────────────────────────────────────────────────────────────

const ranges = [
  { key: 'day', label: 'Today', days: 1 },
  { key: 'week', label: 'This week', days: 7 },
  { key: 'month', label: 'This month', days: 30 },
] as const
const range = ref<(typeof ranges)[number]['key']>('week')

const best = useContentShelf('h4-best', () => {
  if (!ready.value) return null
  const days = ranges.find((r) => r.key === range.value)!.days
  return {
    filters: [curatedFilter(tags.value, null, createdSince(days))],
    sort: '-likes:length,-created',
    limit: 18,
    minItems: 1,
  }
})

/** Ranks by position in the like-sorted list, which masonry dealing would scramble. */
const rankOf = computed(() => new Map(best.items.value.map((item, i) => [item.id, i + 1])))

const { colCount } = useResponsiveColumns()
// The sidebar takes a column's worth of width on large screens.
const bestCols = computed(() => Math.max(1, Math.min(3, colCount.value - 1)))
const { columns } = useMasonry(best.items, bestCols)

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const popularTags = computed(() =>
  tally(best.items.value, (item) => [
    ...(item.expand?.tag ?? []),
    ...(item.expand?.labels ?? []).map((l) => ({ id: `label:${l.id}`, name: l.name })),
  ]).slice(0, 10),
)

function tagLink(entry: Tally) {
  if (entry.id.startsWith('label:')) {
    const label = best.items.value
      .flatMap((item) => item.expand?.labels ?? [])
      .find((l) => `label:${l.id}` === entry.id)
    return label ? `/labels/${label.slug}` : '/'
  }
  return { path: '/', query: { tag: entry.name } }
}

/**
 * This week's uploaders by number of site uploads. Counted over one light
 * request — just the uploader relation — since there's no weekly aggregate.
 */
const topUploaders = ref<Tally[]>([])
const freshCollections = ref<CollectionsItem[]>([])

watch(
  ready,
  async (isReady) => {
    if (!isReady) return
    try {
      const [sample, collections] = await Promise.all([
        pb.collection('contents').getList<ContentsItem>(1, 500, {
          filter: curatedFilter(tags.value, null, createdSince(7)),
          expand: 'uploader',
          fields: 'id,expand.uploader.id,expand.uploader.name',
          skipTotal: true,
          requestKey: 'h4-uploaders',
        }),
        pb.collection('contents_collections').getList<CollectionsItem>(1, 5, {
          filter: 'isPublic=true&&contents_via_collections.id?!=""',
          sort: '-updated',
          skipTotal: true,
          requestKey: 'h4-collections',
        }),
      ])
      topUploaders.value = tally(sample.items, (item) => [item.expand?.uploader]).slice(0, 5)
      freshCollections.value = collections.items
    } catch (err) {
      if (!(err as any)?.isAbort) console.error('[home4] sidebar failed:', err)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="grid gap-10 pt-2 lg:grid-cols-[minmax(0,1fr)_300px]">
    <div class="flex min-w-0 flex-col gap-10">
      <!-- Gif of the day -->
      <section aria-labelledby="home4-gotd" class="flex flex-col gap-4">
        <h1 id="home4-gotd" class="micro-label text-pink-400">Gif of the day · {{ today }}</h1>
        <USkeleton v-if="spotlight.isLoading.value" class="aspect-[16/10] w-full rounded-2xl" />
        <template v-else-if="gifOfTheDay">
          <HomeTile :content="gifOfTheDay" aspect="16 / 10" rounded="rounded-2xl" />
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="min-w-0">
              <p class="truncate font-display text-[26px] font-semibold text-night-50">
                {{ gifOfTheDay.title || 'Untitled' }}
              </p>
              <p class="text-sm text-night-300">
                <template v-if="gifOfTheDay.expand?.uploader">
                  by
                  <NuxtLink
                    :to="`/uploaders/${gifOfTheDay.expand.uploader.name}`"
                    class="font-semibold text-emerald-400 hover:text-emerald-300"
                  >
                    {{ gifOfTheDay.expand.uploader.name }}
                  </NuxtLink>
                  ·
                </template>
                {{ gifOfTheDay.expand?.likes?.length ?? 0 }} likes
              </p>
            </div>
            <div class="flex gap-2">
              <UButton
                :to="`/single/${gifOfTheDay.id}`"
                label="Open"
                icon="i-lucide-maximize-2"
                size="lg"
              />
              <UButton
                label="Copy link"
                icon="i-lucide-link"
                size="lg"
                color="neutral"
                variant="outline"
                @click="copyLink(shortLink(gifOfTheDay, 'preview'), 'preview')"
              />
            </div>
          </div>
        </template>
      </section>

      <!-- Best of -->
      <HomeSection title="Best of Goyangi" subtitle="Ranked by likes.">
        <template #actions>
          <div class="flex gap-1 rounded-full bg-night-900 p-1" role="group" aria-label="Period">
            <button
              v-for="r in ranges"
              :key="r.key"
              type="button"
              class="rounded-full px-3 py-1 text-sm font-semibold transition-colors"
              :class="
                range === r.key
                  ? 'bg-pink-400 text-night-950'
                  : 'text-night-300 hover:text-night-50'
              "
              :aria-pressed="range === r.key"
              @click="range = r.key"
            >
              {{ r.label }}
            </button>
          </div>
        </template>

        <div v-if="best.isLoading.value" class="mt-10 flex justify-center">
          <LoadingSpinner />
        </div>
        <ContentGrid v-else-if="best.items.value.length" :columns="columns">
          <template #default="{ item }">
            <div class="relative">
              <span
                class="absolute -left-1.5 -top-1.5 z-30 flex size-7 items-center justify-center rounded-full bg-pink-400 font-display text-sm font-bold text-night-950 shadow-md pointer-events-none"
              >
                {{ rankOf.get(item.id) }}
              </span>
              <CardBaseContent :content="item" @filters-apply="openInFeed" />
            </div>
          </template>
        </ContentGrid>
        <p v-else class="mt-10 text-center text-night-300">
          Nothing ranked yet for this period. Try a longer one.
        </p>
      </HomeSection>
    </div>

    <!-- Sidebar -->
    <aside class="flex flex-col gap-6 lg:pt-8">
      <section v-if="popularTags.length" class="surface-card p-5" aria-labelledby="home4-popular">
        <h2 id="home4-popular" class="micro-label mb-3 text-night-300">Popular right now</h2>
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="entry in popularTags"
            :key="entry.id"
            :to="tagLink(entry)"
            class="rounded-full bg-pink-400/10 px-3 py-1 text-sm font-medium text-pink-300 hover:bg-pink-400/20"
          >
            #{{ entry.name }}
          </NuxtLink>
        </div>
      </section>

      <section
        v-if="topUploaders.length"
        class="surface-card p-5"
        aria-labelledby="home4-uploaders"
      >
        <h2 id="home4-uploaders" class="micro-label mb-3 text-night-300">
          Top uploaders this week
        </h2>
        <ol class="flex flex-col gap-2.5">
          <li v-for="(u, i) in topUploaders" :key="u.id" class="flex items-center gap-3">
            <span class="w-4 font-display font-bold text-night-400">{{ i + 1 }}</span>
            <NuxtLink
              :to="`/uploaders/${u.name}`"
              class="min-w-0 flex-1 truncate font-semibold text-emerald-400 hover:text-emerald-300"
            >
              {{ u.name }}
            </NuxtLink>
            <span class="text-xs text-night-300">{{ u.count }} posts</span>
          </li>
        </ol>
      </section>

      <section
        v-if="freshCollections.length"
        class="surface-card p-5"
        aria-labelledby="home4-collections"
      >
        <h2 id="home4-collections" class="micro-label mb-3 text-night-300">Fresh collections</h2>
        <ul class="flex flex-col gap-3">
          <li v-for="c in freshCollections" :key="c.id">
            <NuxtLink :to="`/collection/${c.id}`" class="group flex items-center gap-3">
              <img
                v-if="c.cover"
                :src="c.cover"
                alt=""
                class="size-12 shrink-0 rounded-lg bg-night-800 object-cover"
                loading="lazy"
              />
              <span v-else class="size-12 shrink-0 rounded-lg bg-night-800" />
              <span class="min-w-0 truncate font-medium text-night-100 group-hover:text-night-50">
                {{ c.title }}
              </span>
            </NuxtLink>
          </li>
        </ul>
        <NuxtLink
          to="/collections"
          class="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-pink-400 hover:text-pink-300"
        >
          All collections <UIcon name="i-lucide-arrow-right" class="size-4" />
        </NuxtLink>
      </section>
    </aside>
  </div>
</template>
