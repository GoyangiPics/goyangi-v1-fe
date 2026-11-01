<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { ContentsItem, Group, Idol } from '~/types/appTypes'
import { computed, ref } from 'vue'
import { createdSince, curatedFilter, starredClause, tally } from '~/utils/homeCuration'
import { idolQueryToken } from '~/utils/idolSelection'

/**
 * Home trial 5 — idol first.
 *
 * Leads with the one thing a general gif site can't do: "who's your bias?".
 * Search for an idol or group, see what's new from the ones you follow, then
 * the groups that are busiest right now.
 */
useHead({ title: 'Home' })
definePageMeta({ middleware: ['auth'] })

const pb = usePocketBase()
const { ready, referenceStore, starsStore } = useHomeReady()
const { since: lastVisit } = useLastVisit()
const tags = computed(() => referenceStore.tags)
const isStarsVisible = ref(false)

function groupName(id: string) {
  return referenceStore.groups.find((g) => g.id === id)?.name ?? ''
}

function idolLink(idol: Idol): RouteLocationRaw {
  return {
    path: '/',
    query: { idol: idolQueryToken(idol, referenceStore.idols, referenceStore.groups) },
  }
}

function groupLink(group: Pick<Group, 'name'>): RouteLocationRaw {
  return { path: '/', query: { group: group.name } }
}

// ─── Search ──────────────────────────────────────────────────────────────────

const query = ref('')

interface Match {
  kind: 'idol' | 'group'
  id: string
  name: string
  detail: string
  to: RouteLocationRaw
}

/** Groups first, then idols; names and aliases, prefix matches ahead of the rest. */
const matches = computed<Match[]>(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  const score = (name: string, aliases?: string) => {
    const n = name.toLowerCase()
    if (n.startsWith(q)) return 0
    if (n.includes(q) || (aliases ?? '').toLowerCase().includes(q)) return 1
    return -1
  }
  const groups = referenceStore.groups
    .map((g) => ({ g, s: score(g.name, g.aliases) }))
    .filter((x) => x.s >= 0)
    .map(({ g, s }) => ({
      s,
      m: { kind: 'group', id: g.id, name: g.name, detail: 'Group', to: groupLink(g) } as Match,
    }))
  const idols = referenceStore.idols
    .map((i) => ({ i, s: score(i.name, i.aliases) }))
    .filter((x) => x.s >= 0)
    .map(({ i, s }) => ({
      s,
      m: {
        kind: 'idol',
        id: i.id,
        name: i.name,
        detail: groupName(i.group) || 'Soloist',
        to: idolLink(i),
      } as Match,
    }))
  return [...groups, ...idols]
    .toSorted((a, b) => a.s - b.s)
    .slice(0, 8)
    .map((x) => x.m)
})

function isStarred(m: Match) {
  return m.kind === 'idol' ? starsStore.isIdolStarred(m.id) : starsStore.isGroupStarred(m.id)
}

function toggleStar(m: Match) {
  void (m.kind === 'idol' ? starsStore.toggleIdol(m.id) : starsStore.toggleGroup(m.id))
}

function openFirst() {
  const first = matches.value[0]
  if (first) void navigateTo(first.to)
}

// ─── Your idols ──────────────────────────────────────────────────────────────

/**
 * Recent posts across everyone followed, in one request. Each face below is the
 * newest still of that idol or group, and the badge counts how many of these
 * arrived since the last visit.
 */
const followedRecent = useContentShelf('h5-followed', () => {
  if (!ready.value) return null
  const scope = starredClause(starsStore.idolIds, starsStore.groupIds)
  return scope
    ? { filters: [curatedFilter(tags.value, null, scope)], limit: 120, minItems: 1 }
    : false
})

interface Face {
  key: string
  name: string
  to: RouteLocationRaw
  cover?: ContentsItem
  fresh: number
}

const faces = computed<Face[]>(() => {
  const recent = followedRecent.items.value
  const since = lastVisit.value
  const build = (key: string, name: string, to: RouteLocationRaw, posts: ContentsItem[]): Face => ({
    key,
    name,
    to,
    cover: posts.find((p) => contentThumbUrl(p)),
    fresh: since ? posts.filter((p) => new Date(p.created).getTime() > since).length : 0,
  })
  const groups = starsStore.groupIds.flatMap((id) => {
    const group = referenceStore.groups.find((g) => g.id === id)
    if (!group) return []
    return [
      build(
        `g:${id}`,
        group.name,
        groupLink(group),
        recent.filter((p) => p.group?.includes(id)),
      ),
    ]
  })
  const idols = starsStore.idolIds.flatMap((id) => {
    const idol = referenceStore.idols.find((i) => i.id === id)
    if (!idol) return []
    return [
      build(
        `i:${id}`,
        idol.name,
        idolLink(idol),
        recent.filter((p) => p.idol?.includes(id)),
      ),
    ]
  })
  return [...groups, ...idols].toSorted((a, b) => b.fresh - a.fresh).slice(0, 14)
})

// ─── Popular groups ──────────────────────────────────────────────────────────

/** A month of site gifs, newest first, grouped below by who's in them. */
const sample = useContentShelf('h5-sample', () =>
  ready.value
    ? { filters: [curatedFilter(tags.value, 'gif', createdSince(30))], limit: 150, minItems: 1 }
    : null,
)

const popularGroups = computed(() => {
  const items = sample.items.value
  const weekAgo = Date.now() - 7 * 86_400_000
  return tally(items, (item) => item.expand?.group ?? [])
    .slice(0, 6)
    .map((entry) => {
      const posts = items.filter((p) => p.group?.includes(entry.id))
      const members = referenceStore.idols.filter((i) => i.group === entry.id)
      return {
        ...entry,
        posts: posts.slice(0, 3),
        thisWeek: posts.filter((p) => new Date(p.created).getTime() > weekAgo).length,
        members: members.slice(0, 5),
        moreMembers: Math.max(0, members.length - 5),
      }
    })
})

// ─── Just added ──────────────────────────────────────────────────────────────

const justAdded = computed(() => sample.items.value.slice(0, 10))
</script>

<template>
  <div class="flex flex-col gap-12 pt-2">
    <!-- Hero -->
    <section class="flex flex-col items-center gap-5 py-6 text-center">
      <h1 class="font-display text-[44px] font-semibold leading-tight text-night-50 sm:text-[56px]">
        Who's your <span class="gradient-text">bias?</span>
      </h1>
      <p class="text-[15px] text-night-300">
        Find an idol or group. Follow them to build a feed of only their gifs.
      </p>
      <form class="relative w-full max-w-xl" role="search" @submit.prevent="openFirst">
        <UInput
          v-model="query"
          icon="i-lucide-search"
          size="xl"
          placeholder="Search idols and groups"
          aria-label="Search idols and groups"
          class="w-full"
          :ui="{ base: 'rounded-full' }"
        />
        <ul
          v-if="matches.length"
          class="surface-card absolute inset-x-0 top-full z-40 mt-2 overflow-hidden py-1 text-left"
        >
          <li v-for="m in matches" :key="`${m.kind}:${m.id}`" class="flex items-center gap-2 px-2">
            <NuxtLink
              :to="m.to"
              class="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 hover:bg-night-800"
            >
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-full bg-night-700 text-sm font-semibold text-night-100"
              >
                {{ m.name.charAt(0) }}
              </span>
              <span class="min-w-0">
                <span class="block truncate font-semibold text-night-50">{{ m.name }}</span>
                <span class="text-xs text-night-300">{{ m.detail }}</span>
              </span>
            </NuxtLink>
            <UButton
              :icon="isStarred(m) ? 'i-lucide-check' : 'i-lucide-plus'"
              :label="isStarred(m) ? 'Following' : 'Follow'"
              size="sm"
              :color="isStarred(m) ? 'neutral' : 'primary'"
              :variant="isStarred(m) ? 'soft' : 'solid'"
              @click="toggleStar(m)"
            />
          </li>
        </ul>
      </form>
    </section>

    <!-- Your idols -->
    <HomeSection
      v-if="starsStore.hasAny"
      title="Your idols"
      subtitle="New since your last visit."
      to="/me/feed"
      to-label="Open my feed"
    >
      <template #actions>
        <UButton
          label="Edit"
          icon="i-lucide-pencil"
          size="sm"
          color="neutral"
          variant="ghost"
          @click="isStarsVisible = true"
        />
      </template>
      <div class="-mx-1 flex gap-5 overflow-x-auto px-1 pb-2 pt-2">
        <template v-if="followedRecent.isLoading.value">
          <USkeleton v-for="i in 6" :key="i" class="size-20 shrink-0 rounded-full" />
        </template>
        <NuxtLink
          v-for="face in faces"
          v-else
          :key="face.key"
          :to="face.to"
          class="group flex w-20 shrink-0 flex-col items-center gap-2"
        >
          <span class="relative">
            <img
              v-if="face.cover"
              :src="contentThumbUrl(face.cover)"
              alt=""
              class="size-20 rounded-full object-cover ring-2 ring-pink-400 ring-offset-2 ring-offset-night-950 transition-transform group-hover:scale-105"
              loading="lazy"
            />
            <span
              v-else
              class="flex size-20 items-center justify-center rounded-full bg-night-800 font-display text-[24px] font-semibold text-night-200 ring-2 ring-night-600 ring-offset-2 ring-offset-night-950"
            >
              {{ face.name.charAt(0) }}
            </span>
            <span
              v-if="face.fresh"
              class="absolute -right-1 -top-1 min-w-6 rounded-full bg-pink-500 px-1.5 py-0.5 text-center text-xs font-bold text-white ring-2 ring-night-950"
            >
              {{ face.fresh >= 99 ? '99+' : face.fresh }}
            </span>
          </span>
          <span class="w-full truncate text-center text-sm font-medium text-night-100">
            {{ face.name }}
          </span>
        </NuxtLink>
      </div>
    </HomeSection>

    <section
      v-else-if="ready"
      class="surface-card flex flex-wrap items-center justify-between gap-4 px-6 py-5"
      aria-label="Follow idols"
    >
      <div>
        <h2 class="font-display text-[20px] font-semibold text-night-50">
          Follow your idols for a feed of your own
        </h2>
        <p class="text-sm text-night-300">
          Search above, or pick from the full list. You can change it any time.
        </p>
      </div>
      <UButton label="Pick idols" icon="i-lucide-star" size="lg" @click="isStarsVisible = true" />
    </section>

    <!-- Popular groups -->
    <HomeSection title="Popular groups" subtitle="Who got the most new gifs this month.">
      <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <template v-if="sample.isLoading.value">
          <USkeleton v-for="i in 6" :key="i" class="h-[300px] rounded-2xl" />
        </template>
        <NuxtLink
          v-for="group in popularGroups"
          v-else
          :key="group.id"
          :to="groupLink(group)"
          class="surface-card group flex flex-col gap-3 p-3 hover:border-pink-400/40"
        >
          <div class="grid h-[200px] grid-cols-3 grid-rows-2 gap-2">
            <div
              v-for="(post, i) in group.posts"
              :key="post.id"
              :class="i === 0 ? 'col-span-2 row-span-2' : ''"
            >
              <HomeTile :content="post" fill :to="false" rounded="rounded-lg" />
            </div>
          </div>
          <div class="flex items-center justify-between gap-3 px-1 pb-1">
            <div class="min-w-0">
              <p class="truncate font-display text-[18px] font-semibold text-night-50">
                {{ group.name }}
              </p>
              <p class="text-xs text-night-300">{{ group.thisWeek }} new gifs this week</p>
            </div>
            <div class="flex shrink-0 -space-x-2">
              <span
                v-for="member in group.members"
                :key="member.id"
                :title="member.name"
                class="flex size-7 items-center justify-center rounded-full bg-night-700 text-xs font-semibold text-night-100 ring-2 ring-night-900"
              >
                {{ member.name.charAt(0) }}
              </span>
              <span
                v-if="group.moreMembers"
                class="flex size-7 items-center justify-center rounded-full bg-night-800 text-[10px] font-semibold text-night-300 ring-2 ring-night-900"
              >
                +{{ group.moreMembers }}
              </span>
            </div>
          </div>
        </NuxtLink>
      </div>
    </HomeSection>

    <!-- Just added -->
    <HomeSection
      title="Just added"
      :to="{ path: '/', query: { filetype: 'gif', origin: 'direct,imgur' } }"
    >
      <HomeCardRow :items="justAdded" :loading="sample.isLoading.value" />
    </HomeSection>

    <DialogManageStars
      v-if="isStarsVisible"
      :is-visible="isStarsVisible"
      @update:is-visible="isStarsVisible = $event"
    />
  </div>
</template>
