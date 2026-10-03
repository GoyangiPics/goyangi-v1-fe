<script setup lang="ts">
import type { LabelStat } from '~/types/appTypes'
import { computed, onMounted, ref } from 'vue'

// Public, unlike /uploaders. This is the browse surface for a shared namespace
// and the one new page with real SEO value; every mutating action on it is still
// behind requireAuth.

const pb = usePocketBase()
const toast = useToast()
const confirm = useConfirm()
const authStore = useAuthStore()

const entries = ref<LabelStat[]>([])
const total = ref(0)
const page = ref(1)
const perPage = 100
const isLoading = ref(true)
const search = ref('')

useSeoMeta({
  title: 'Labels — Goyangi',
  description: 'Browse every label in the library.',
})

/**
 * Reads the `labels_stats` view, which carries a `uses` count per label.
 *
 * Paginated, unlike /uploaders (which reads its own `uploaders_stats` view in
 * full): a namespace anyone can add to has no natural size, so this one pages.
 */
async function load() {
  isLoading.value = true
  try {
    const res = await pb.collection('labels_stats').getList<LabelStat>(page.value, perPage, {
      sort: 'name',
      filter: search.value.trim() ? pb.filter('name~{:term}', { term: search.value.trim() }) : '',
      requestKey: 'labelsStats',
    })
    entries.value = res.items
    total.value = res.totalItems
  } catch (error: any) {
    if (!error?.isAbort) console.error('Could not load labels:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(load)

let searchTimer: ReturnType<typeof setTimeout> | undefined
function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 250)
}

const firstItemIndex = computed(() => (page.value - 1) * perPage)

async function changePage(e: any) {
  page.value = e.page + 1
  await load()
  window.scrollTo(0, 0)
}

/**
 * The home feed filtered by a label, as a route.
 *
 * A link rather than filtersApply-then-push: the URL is the filter state, so
 * `?label=<slug>` on home is the whole action, and being a real anchor means
 * the label can be opened in a new tab.
 */
function browseTarget(label: LabelStat) {
  return { path: '/', query: { label: label.slug ?? '' } }
}

async function remove(label: LabelStat) {
  // Surfaced as a disabled control with a reason (see the template), so this is
  // only reachable when the count says zero — but the count can be stale, and
  // the backend guard is the real gate, so handle its rejection.
  if (
    !(await confirm({
      message: `Delete the label "${label.name}"?`,
      icon: 'i-lucide-trash-2',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      color: 'error',
    }))
  ) {
    return
  }
  try {
    await pb.collection('labels').delete(label.id)
    toast.add({ title: 'Deleted', color: 'success', duration: 2000 })
    await load()
  } catch (error: any) {
    toast.add({
      title: 'Still in use',
      description: error?.response?.message ?? 'Remove it from all content first.',
      color: 'warning',
      duration: 4000,
    })
  }
}
</script>

<template>
  <div>
    <NavigationBase class="my-4" />

    <PageHeader emoji="🏷️" title="Labels" :total="total" total-label="labels" />

    <div
      class="filter-input-wrapper relative flex items-center gap-1.5 pl-10 pr-2 py-1 min-h-8 mb-4"
    >
      <UIcon
        name="i-lucide-search"
        class="absolute top-1/2 -translate-y-1/2 left-3 text-night-400 dark:text-night-600"
      />
      <input
        v-model="search"
        type="text"
        placeholder="Search labels..."
        class="filter-input flex-1 bg-transparent outline-none border-0 text-sm py-1"
        @input="onSearch"
      />
    </div>

    <div v-if="isLoading" class="flex justify-center items-center mt-16">
      <LoadingSpinner />
    </div>

    <div v-else-if="!entries.length" class="flex justify-center items-center mt-16">
      <h1 class="text-2xl text-night-400">No labels yet.</h1>
    </div>

    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="glass-card p-4 flex flex-col gap-2 transition-all duration-200 hover:border-primary/40 hover:-translate-y-0.5 group relative"
      >
        <NuxtLink
          :to="`/labels/${encodeURIComponent(entry.slug ?? '')}`"
          class="flex flex-col gap-2"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-tag" class="text-primary-300 shrink-0" />
            <p class="text-sm font-semibold text-night-100 truncate" :title="entry.name">
              {{ entry.name }}
            </p>
          </div>
          <div class="flex items-center gap-1.5 text-xs text-primary-300 font-mono">
            <span>{{ entry.uses ?? 0 }} item{{ (entry.uses ?? 0) === 1 ? '' : 's' }}</span>
          </div>
        </NuxtLink>

        <div class="flex items-center gap-1 mt-auto">
          <UButton
            icon="i-lucide-filter"
            size="xs"
            color="neutral"
            variant="ghost"
            title="Filter the feed by this label"
            :to="browseTarget(entry)"
          />
          <!-- Admin-only, and disabled with the reason rather than allowed to
               fail: "cannot delete while in use" is a backend invariant, so it
               should read as a state, not an error. -->
          <UTooltip
            v-if="authStore.isAdmin"
            :text="
              (entry.uses ?? 0) > 0
                ? `Still applied to ${entry.uses} item(s) — remove them first`
                : 'Delete label'
            "
            :content="{ side: 'top' }"
          >
            <UButton
              icon="i-lucide-trash-2"
              size="xs"
              color="error"
              variant="ghost"
              :disabled="(entry.uses ?? 0) > 0"
              @click="remove(entry)"
            />
          </UTooltip>
        </div>
      </div>
    </div>

    <ListingPaginator :first="firstItemIndex" :rows="perPage" :total="total" @page="changePage" />
  </div>
</template>
