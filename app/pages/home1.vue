<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { ShelfQuery } from '~/composables/useContentShelf'
import type { HomeTopic } from '~/utils/homeCuration'
import { computed, ref } from 'vue'
import {
  createdSince,
  curatedFilter,
  homeTopic,
  starredClause,
  tally,
  topicFeedQuery,
  topicFilter,
} from '~/utils/homeCuration'

/**
 * Home trial 1 — curated rows, gifs first.
 *
 * A short featured mosaic, then one row per kind of post, so a first visit sees
 * the range of the site instead of whatever the Discord bot ingested last.
 * Site uploads only; the full feed stays at `/`.
 */
useHead({ title: 'Home' })
// TEMP(dev): open to signed-out visitors for the home trials. Restore
// `definePageMeta({ middleware: ['auth'] })` before this reaches main.

const { ready, referenceStore, starsStore } = useHomeReady()
const tags = computed(() => referenceStore.tags)
const isStarsVisible = ref(false)

/** Gifs ranked by likes, widening the window until there are enough. */
function trending(limit: number, days: number[]): ShelfQuery | null {
  if (!ready.value) return null
  return {
    filters: [
      ...days.map((d) => curatedFilter(tags.value, 'gif', createdSince(d))),
      curatedFilter(tags.value),
    ],
    sort: '-likes:length,-created',
    limit,
  }
}

const featured = useContentShelf('h1-featured', () => trending(5, [30, 90]))

interface Row {
  key: string
  title: string
  subtitle: string
  shelf: ReturnType<typeof useContentShelf>
  to: () => RouteLocationRaw
}

function topicRow(key: string, title: string, subtitle: string, topic: HomeTopic): Row {
  return {
    key,
    title,
    subtitle,
    shelf: useContentShelf(`h1-${key}`, () => {
      if (!ready.value) return null
      const filter = topicFilter(topic, tags.value)
      return filter ? { filters: [filter], limit: 12 } : false
    }),
    to: () => ({ path: '/', query: topicFeedQuery(topic, tags.value) }),
  }
}

const vlogsAndLive: HomeTopic = {
  key: 'vlogs-live',
  label: 'Vlogs & live',
  tags: ['vlog', 'live'],
  icon: 'i-lucide-camera',
}

const rows: Row[] = [
  {
    key: 'trending',
    title: 'Trending this week',
    subtitle: 'The most liked gifs of the last seven days.',
    shelf: useContentShelf('h1-trending', () => trending(12, [7, 30])),
    to: () => ({ path: '/', query: { top: '1week', filetype: 'gif' } }),
  },
  {
    key: 'yours',
    title: 'From your idols',
    subtitle: 'The newest posts from the idols you follow.',
    shelf: useContentShelf('h1-yours', () => {
      if (!ready.value) return null
      const scope = starredClause(starsStore.idolIds, starsStore.groupIds)
      return scope ? { filters: [curatedFilter(tags.value, null, scope)], limit: 12 } : false
    }),
    to: () => '/me/feed',
  },
  topicRow('cute', 'Cute', 'Aegyo, giggles and everything soft.', homeTopic('cute')),
  topicRow('emotes', 'Emotes', 'Reactions for your group chat.', homeTopic('emotes')),
  topicRow('vlogs', 'Vlogs & live', 'Off-stage moments from vlogs and lives.', vlogsAndLive),
  topicRow('fancams', 'Fancams', 'Stages, from the front row.', homeTopic('fancams')),
  topicRow('videos', 'Videos', 'Longer clips with sound. Click to play.', homeTopic('videos')),
  topicRow('photos', 'Photos', 'Stills, selcas and pictorials.', homeTopic('photos')),
]

/** A row with nothing in it is dropped rather than shown as a blank shelf. */
const visibleRows = computed(() =>
  rows.filter((row) => {
    if (row.key === 'yours' && !starsStore.hasAny) return false
    return row.shelf.isLoading.value || row.shelf.items.value.length > 0
  }),
)

/** Groups seen across everything on the page, most frequent first. */
const groupsOnPage = computed(() => {
  const all = [featured, ...rows.map((r) => r.shelf)].flatMap((s) => s.items.value)
  return tally(all, (item) => item.expand?.group ?? []).slice(0, 14)
})
</script>

<template>
  <div class="flex flex-col gap-12 pt-2">
    <!-- Hero -->
    <section class="grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div class="flex flex-col gap-4">
        <span class="micro-label text-pink-400">Goyangi</span>
        <h1 class="font-display text-[44px] font-semibold leading-[1.05] text-night-50">
          K-pop gifs, <span class="gradient-text">on loop.</span>
        </h1>
        <p class="max-w-md text-[15px] text-night-300">
          Hand-picked gifs, clips and photos of your favourite idols, uploaded in full quality.
        </p>
        <div class="flex flex-wrap gap-3">
          <UButton to="/" label="Browse everything" size="lg" class="search-gradient" />
          <UButton
            v-if="starsStore.hasAny"
            to="/me/feed"
            label="My feed"
            icon="i-lucide-star"
            size="lg"
            color="neutral"
            variant="outline"
          />
          <UButton
            v-else
            label="Pick your idols"
            icon="i-lucide-star"
            size="lg"
            color="neutral"
            variant="outline"
            @click="isStarsVisible = true"
          />
        </div>
      </div>

      <div class="grid h-[340px] grid-cols-4 grid-rows-2 gap-3 sm:h-[420px]">
        <template v-if="featured.isLoading.value">
          <USkeleton class="col-span-2 row-span-2 rounded-xl" />
          <USkeleton v-for="i in 4" :key="i" class="rounded-xl" />
        </template>
        <div
          v-for="(item, i) in featured.items.value"
          v-else
          :key="item.id"
          :class="i === 0 ? 'col-span-2 row-span-2' : ''"
        >
          <HomeTile :content="item" fill />
        </div>
      </div>
    </section>

    <!-- Jump pills -->
    <nav aria-label="Sections" class="-mt-4 flex gap-2 overflow-x-auto pb-1">
      <a
        v-for="row in visibleRows"
        :key="row.key"
        :href="`#${row.key}`"
        class="shrink-0 rounded-full border border-night-700 bg-night-900 px-4 py-1.5 text-sm font-semibold text-night-200 hover:border-pink-400/60 hover:text-night-50"
      >
        {{ row.title }}
      </a>
    </nav>

    <HomeSection
      v-for="row in visibleRows"
      :key="row.key"
      :anchor="row.key"
      :title="row.title"
      :subtitle="row.subtitle"
      :to="row.to()"
    >
      <HomeCardRow :items="row.shelf.items.value" :loading="row.shelf.isLoading.value" />
    </HomeSection>

    <HomeSection
      v-if="groupsOnPage.length"
      title="Browse by group"
      subtitle="Every post from one group, in the full feed."
    >
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-for="group in groupsOnPage"
          :key="group.id"
          :to="{ path: '/', query: { group: group.name } }"
          class="rounded-full bg-night-800 px-4 py-2 text-sm font-semibold text-night-100 hover:bg-night-700"
        >
          {{ group.name }}
        </NuxtLink>
      </div>
    </HomeSection>

    <section
      class="surface-card flex flex-wrap items-center justify-between gap-4 px-6 py-5"
      aria-label="Full feed"
    >
      <div>
        <h2 class="font-display text-[20px] font-semibold text-night-50">Want everything?</h2>
        <p class="text-sm text-night-300">
          The full feed has every upload and everything shared on Discord, newest first.
        </p>
      </div>
      <UButton to="/" label="Open the full feed" trailing-icon="i-lucide-arrow-right" size="lg" />
    </section>

    <DialogManageStars
      v-if="isStarsVisible"
      :is-visible="isStarsVisible"
      @update:is-visible="isStarsVisible = $event"
    />
  </div>
</template>
