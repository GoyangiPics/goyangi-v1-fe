<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import type { Tally } from '~/utils/homeCuration'
import { computed, ref, watch } from 'vue'
import {
  createdSince,
  curatedFilter,
  homeTopic,
  tally,
  topicFeedQuery,
  topicFilter,
} from '~/utils/homeCuration'
import { shortLink } from '~/utils/shortLink'

/**
 * Home trial 3 — search and discover, Giphy-style.
 *
 * Built around finding one gif fast: a big search, a ranked trending strip,
 * moods to wander through, and emotes that copy a link in one click for Discord.
 */
useHead({ title: 'Home' })
definePageMeta({ middleware: ['auth'] })

const pb = usePocketBase()
const { ready, referenceStore } = useHomeReady()
const { copyLink } = useCopyLinks()
const tags = computed(() => referenceStore.tags)

// ─── Search ──────────────────────────────────────────────────────────────────

const query = ref('')

function search() {
  const q = query.value.trim()
  if (!q) return
  void navigateTo({ path: '/', query: { search: q, filetype: 'gif' } })
}

// ─── Trending ────────────────────────────────────────────────────────────────

const trending = useContentShelf('h3-trending', () =>
  ready.value
    ? {
        filters: [
          curatedFilter(tags.value, 'gif', createdSince(7)),
          curatedFilter(tags.value, 'gif', createdSince(30)),
          curatedFilter(tags.value),
        ],
        sort: '-likes:length,-created',
        limit: 10,
      }
    : null,
)

/**
 * The groups behind this week's gifs, counted over a wider sample than the
 * strip shows. One light request: only the group relation comes back.
 */
const trendingGroups = ref<Tally[]>([])
watch(
  ready,
  async (isReady) => {
    if (!isReady) return
    try {
      const sample = await pb.collection('contents').getList<ContentsItem>(1, 300, {
        filter: curatedFilter(tags.value, 'gif', createdSince(14)),
        sort: '-created',
        expand: 'group',
        fields: 'id,expand.group.id,expand.group.name',
        skipTotal: true,
        requestKey: 'h3-groups',
      })
      trendingGroups.value = tally(sample.items, (item) => item.expand?.group ?? []).slice(0, 8)
    } catch (err) {
      if (!(err as any)?.isAbort) console.error('[home3] group sample failed:', err)
    }
  },
  { immediate: true },
)

// ─── Moods ───────────────────────────────────────────────────────────────────

/** Each mood tile wears the best-liked gif of its topic as its background. */
const moods = ['cute', 'emotes', 'vlogs', 'live', 'fancams', 'edits'].map((key) => {
  const topic = homeTopic(key)
  return {
    topic,
    shelf: useContentShelf(`h3-mood-${key}`, () => {
      if (!ready.value) return null
      const filter = topicFilter(topic, tags.value, createdSince(60))
      return filter ? { filters: [filter], sort: '-likes:length,-created', limit: 1 } : false
    }),
  }
})
const visibleMoods = computed(() => moods.filter((m) => m.shelf.items.value.length > 0))

// ─── Emotes ──────────────────────────────────────────────────────────────────

const emotes = useContentShelf('h3-emotes', () => {
  if (!ready.value) return null
  const filter = topicFilter(homeTopic('emotes'), tags.value)
  return filter ? { filters: [filter], sort: '-likes:length,-created', limit: 12 } : false
})

const copiedId = ref<string | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

async function copyEmote(item: ContentsItem) {
  await copyLink(shortLink(item, 'preview') ?? shortLink(item, 'hd'), 'preview')
  copiedId.value = item.id
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copiedId.value = null), 1500)
}

// ─── Clips with sound ────────────────────────────────────────────────────────

const clips = useContentShelf('h3-clips', () =>
  ready.value ? { filters: [curatedFilter(tags.value, 'video')], limit: 8 } : null,
)
</script>

<template>
  <div class="flex flex-col gap-12 pt-2">
    <!-- Hero -->
    <section
      class="relative overflow-hidden rounded-3xl px-6 py-12 text-center sm:px-12 sm:py-16"
      style="
        background:
          radial-gradient(
            120% 140% at 0% 0%,
            color-mix(in oklab, var(--color-pink-500), transparent 70%),
            transparent 60%
          ),
          radial-gradient(
            120% 140% at 100% 100%,
            color-mix(in oklab, var(--color-violet-500), transparent 70%),
            transparent 60%
          ),
          var(--color-night-900);
      "
    >
      <h1 class="font-display text-[40px] font-semibold leading-tight text-night-50 sm:text-[52px]">
        Find the perfect K-pop gif
      </h1>
      <p class="mt-2 text-[15px] text-night-200">
        Reactions, stages and off-stage moments, ready to drop into chat.
      </p>
      <form class="mx-auto mt-7 flex max-w-2xl gap-2" role="search" @submit.prevent="search">
        <UInput
          v-model="query"
          icon="i-lucide-search"
          size="xl"
          placeholder="Search idols, groups or moments"
          aria-label="Search gifs"
          class="flex-1"
          :ui="{ base: 'rounded-full bg-night-50 text-night-950 placeholder:text-night-500' }"
        />
        <UButton type="submit" label="Search" size="xl" class="search-gradient rounded-full px-6" />
      </form>
      <div v-if="trendingGroups.length" class="mt-5 flex flex-wrap justify-center gap-2">
        <span class="micro-label self-center text-night-300">Trending</span>
        <NuxtLink
          v-for="group in trendingGroups"
          :key="group.id"
          :to="{ path: '/', query: { group: group.name, filetype: 'gif' } }"
          class="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-night-50 hover:bg-white/20"
        >
          {{ group.name }}
        </NuxtLink>
      </div>
    </section>

    <HomeSection
      title="Trending now"
      subtitle="Most liked this week."
      :to="{ path: '/', query: { top: '1week', filetype: 'gif' } }"
    >
      <div class="-mx-1 overflow-x-auto px-1 pb-3">
        <div class="flex gap-4">
          <template v-if="trending.isLoading.value">
            <USkeleton v-for="i in 6" :key="i" class="aspect-[3/4] w-[200px] shrink-0 rounded-xl" />
          </template>
          <div
            v-for="(item, i) in trending.items.value"
            v-else
            :key="item.id"
            class="w-[200px] shrink-0"
          >
            <HomeTile :content="item" aspect="3 / 4">
              <span
                class="absolute bottom-2 left-3 font-display text-[44px] font-bold leading-none text-white drop-shadow-[0_2px_8px_rgb(0_0_0/0.6)] pointer-events-none"
              >
                {{ i + 1 }}
              </span>
            </HomeTile>
          </div>
        </div>
      </div>
    </HomeSection>

    <HomeSection v-if="visibleMoods.length" title="Explore by mood">
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div v-for="mood in visibleMoods" :key="mood.topic.key">
          <HomeTile
            :content="mood.shelf.items.value[0]!"
            aspect="16 / 9"
            :to="{ path: '/', query: topicFeedQuery(mood.topic, tags) }"
          >
            <span
              class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none"
            />
            <span
              class="absolute bottom-3 left-4 flex items-center gap-2 font-display text-[24px] font-semibold text-white pointer-events-none"
            >
              <UIcon :name="mood.topic.icon" class="size-5" />
              {{ mood.topic.label }}
            </span>
          </HomeTile>
        </div>
      </div>
    </HomeSection>

    <HomeSection
      v-if="emotes.isLoading.value || emotes.items.value.length"
      title="Emotes for your chat"
      subtitle="Click one to copy its link, then paste it into Discord."
      :to="{ path: '/', query: topicFeedQuery(homeTopic('emotes'), tags) }"
    >
      <div class="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <template v-if="emotes.isLoading.value">
          <USkeleton v-for="i in 12" :key="i" class="aspect-square rounded-xl" />
        </template>
        <button
          v-for="item in emotes.items.value"
          v-else
          :key="item.id"
          type="button"
          class="group/emote relative block rounded-xl text-left focus-visible:outline-2 focus-visible:outline-pink-400"
          :aria-label="`Copy link to ${item.title || 'emote'}`"
          @click="copyEmote(item)"
        >
          <HomeTile :content="item" :to="false" />
          <span
            class="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-full py-1 text-xs font-semibold transition-opacity pointer-events-none"
            :class="
              copiedId === item.id
                ? 'bg-pink-400 text-night-950 opacity-100'
                : 'bg-black/60 text-white opacity-0 group-hover/emote:opacity-100'
            "
          >
            <UIcon
              :name="copiedId === item.id ? 'i-lucide-check' : 'i-lucide-link'"
              class="size-3.5"
            />
            {{ copiedId === item.id ? 'Link copied' : 'Copy link' }}
          </span>
        </button>
      </div>
    </HomeSection>

    <HomeSection
      v-if="trendingGroups.length"
      title="Trending groups"
      subtitle="Who got the most new gifs in the last two weeks."
    >
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NuxtLink
          v-for="(group, i) in trendingGroups"
          :key="group.id"
          :to="{ path: '/', query: { group: group.name, filetype: 'gif' } }"
          class="surface-card flex items-center gap-3 px-4 py-3 hover:border-pink-400/40"
        >
          <span class="font-display text-[22px] font-bold text-pink-400">{{ i + 1 }}</span>
          <span class="min-w-0">
            <span class="block truncate font-semibold text-night-50">{{ group.name }}</span>
            <span class="text-xs text-night-300">{{ group.count }} new gifs</span>
          </span>
        </NuxtLink>
      </div>
    </HomeSection>

    <HomeSection
      v-if="clips.isLoading.value || clips.items.value.length"
      title="Clips with sound"
      subtitle="Longer moments. They only play when you click."
      :to="{ path: '/', query: { filetype: 'video', origin: 'direct,imgur' } }"
    >
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <template v-if="clips.isLoading.value">
          <USkeleton v-for="i in 4" :key="i" class="aspect-video rounded-xl" />
        </template>
        <div v-for="item in clips.items.value" v-else :key="item.id" class="flex flex-col gap-2">
          <HomeTile :content="item" aspect="16 / 9" />
          <span class="truncate text-sm font-medium text-night-100">{{ item.title }}</span>
        </div>
      </div>
    </HomeSection>
  </div>
</template>
