<script setup lang="ts">
import type { FilterOption, Filters, LabelRef } from '~/types/typesFilters'
import { CalendarDate } from '@internationalized/date'
import { useDebounceFn } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'

const emit = defineEmits(['filtersApply'])

const pb = usePocketBase()
const toast = useToast()

const isPopoverOpen = ref(false)
const popoverAnchor = ref<HTMLElement | null>(null)
const idolMenuRef = ref<{ clearSearch: () => void } | null>(null)

const filtersStore = useFiltersStore()
const referenceStore = useReferenceStore()
const { requireAuth } = useAuthGate()

// makeDefaultFilters, not a local literal: this shape was written out here twice
// (here and in filtersReset) plus once in the store, so every added field was a
// three-place edit that had to agree — and silently type-errored when it didn't.
const filters = ref<Filters>(makeDefaultFilters())

const multiSelectIdols = computed({
  get(): any[] {
    const expanded = [...filters.value.idol]
    for (const grp of filters.value.group) {
      const groupIdols = referenceStore.idols.filter((i: any) => i.group === grp.id)
      for (const idol of groupIdols) {
        if (!expanded.some((e: any) => e.id === idol.id)) expanded.push(idol)
      }
    }
    return expanded
  },
  set(newIdols: any[]) {
    const byGroup = new Map<string, any[]>()
    const noGroup: any[] = []
    for (const idol of newIdols) {
      const gid = (idol as any).group
      if (gid) {
        if (!byGroup.has(gid)) byGroup.set(gid, [])
        byGroup.get(gid)!.push(idol)
      } else {
        noGroup.push(idol)
      }
    }
    const remainingIdols: any[] = [...noGroup]
    const newGroups: any[] = []
    for (const [gid, selected] of byGroup) {
      const allInGroup = referenceStore.idols.filter((i: any) => i.group === gid)
      if (allInGroup.length > 0 && selected.length === allInGroup.length) {
        const grp = referenceStore.groups.find((g: any) => g.id === gid)
        if (grp) newGroups.push(grp)
      } else {
        remainingIdols.push(...selected)
      }
    }
    filters.value.idol = remainingIdols
    filters.value.group = newGroups
  },
})

// In-field chip removal for the tag/uploader selects (same affordance the
// old MultiSelect display="chip" gave).
function removeFilterChip(key: 'tag' | 'uploader', id: string, event: Event) {
  event.stopPropagation()
  filters.value[key] = (filters.value[key] as any[]).filter((i: any) => i.id !== id)
}

const selectedSavedFilter = ref<any>(null)
const isCreateSavedFilterVisible = ref(false)
const filterName = ref('')

// Saved filters belong to a user record — anonymous visitors can filter
// freely, they just can't persist a preset.
function openCreateSavedFilter() {
  if (!requireAuth('save a filter')) return
  isCreateSavedFilterVisible.value = true
}

// Date bridge: the filters keep JS Dates, UInputDate works with CalendarDate.
const toCal = (d: Date | null) =>
  d ? new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate()) : undefined
const fromCal = (c?: { year: number; month: number; day: number } | null) =>
  c ? new Date(c.year, c.month - 1, c.day) : null

const dateRangeModel = computed({
  get: () => ({
    start: toCal(filters.value.date[0] ?? null),
    end: toCal(filters.value.date[1] ?? null),
  }),
  set: (v) => {
    if (!v || (!v.start && !v.end)) {
      filters.value.date = []
      return
    }
    filters.value.date = [fromCal(v.start), fromCal(v.end)]
  },
})

// UTabs models hold the option's `value` string; bridge to the FilterOption objects.
const sortTabItems = filtersStore.sortType.map((o) => ({ label: o.option, value: o.value }))
const sortModel = computed({
  get: () => filters.value.sort?.value,
  set: (v) => {
    filters.value.sort = filtersStore.sortType.find((o) => o.value === v) ?? null
  },
})

const dateModeTabItems = filtersStore.dateMode.map((o) => ({ label: o.option, value: o.value }))
const dateModeModel = computed({
  get: () => filters.value.dateMode?.value,
  set: (v) => {
    filters.value.dateMode = filtersStore.dateMode.find((o) => o.value === v) ?? null
  },
})

// Content type was a multiple SelectButton; UTabs is single-select, so this is
// a hand-rolled pill toggle group instead.
function isFiletypeSelected(option: FilterOption) {
  return filters.value.filetype.some((f) => f.value === option.value)
}

function toggleFiletype(option: FilterOption) {
  filters.value.filetype = isFiletypeSelected(option)
    ? filters.value.filetype.filter((f) => f.value !== option.value)
    : [...filters.value.filetype, option]
}

// Labels are fetched on demand rather than from referenceStore — they're
// user-created and unbounded, so loading them all at session start would be a
// getFullList that grows without limit.
const { isSearching: isSearchingLabels, searchLabels } = useLabels()
const labelSearchTerm = ref('')

// Narrowed to LabelRef, the shape filters.label holds, so the select's items and
// its model are the same type — `by="slug"` then matches selections correctly
// whether they came from a search or from a `?label=` URL param.
const labelResults = ref<LabelRef[]>([])

const runLabelSearch = useDebounceFn(async () => {
  const found = await searchLabels(labelSearchTerm.value)
  labelResults.value = found.map((l) => ({ id: l.id, name: l.name, slug: l.slug }))
}, 250)

// immediate: without an initial fetch the select is empty until you type, which
// reads as "there are no labels" rather than "search for one". An empty term
// lists the first page by name, matching what the tag select shows on open.
watch(labelSearchTerm, () => runLabelSearch(), { immediate: true })

function removeLabelChip(slug: string, event: Event) {
  event.stopPropagation()
  filters.value.label = filters.value.label.filter((l) => l.slug !== slug)
}

function isOriginSelected(option: FilterOption) {
  return filters.value.origin.some((o) => o.value === option.value)
}

// Neither selected means "all" — the same convention as content type, and why
// origin is an array in Filters rather than a scalar tri-state.
function toggleOrigin(option: FilterOption) {
  filters.value.origin = isOriginSelected(option)
    ? filters.value.origin.filter((o) => o.value !== option.value)
    : [...filters.value.origin, option]
}

onMounted(() => {
  filters.value = JSON.parse(JSON.stringify(filtersStore.filters))
  for (const date in filters.value.date) {
    if (filters.value.date[date]) {
      filters.value.date[date] = new Date(filters.value.date[date] as Date)
    }
  }
})

// Reka dismisses the popover on pointerdown-outside (capture phase, so the
// trigger can't stop it); by the time the trigger's click fires, `open` is
// already false and a plain toggle would instantly reopen it. Track the
// dismiss moment so a click that caused it counts as "close".
let dismissedAt = 0
watch(isPopoverOpen, (open) => {
  if (!open) dismissedAt = Date.now()
})

function toggle(event: MouseEvent) {
  if (!isPopoverOpen.value && Date.now() - dismissedAt < 300) return

  filters.value = JSON.parse(JSON.stringify(filtersStore.filters))
  for (const date in filters.value.date) {
    if (filters.value.date[date]) {
      filters.value.date[date] = new Date(filters.value.date[date] as Date)
    }
  }
  // Reopening the panel starts a fresh search — the picker deliberately keeps
  // its term across selection and blur, so it has to be told.
  idolMenuRef.value?.clearSearch()
  // Anchor the popover to whichever button triggered it (old toggle(event) parity).
  popoverAnchor.value = (event.currentTarget ?? event.target) as HTMLElement | null
  isPopoverOpen.value = !isPopoverOpen.value
}

defineExpose({ toggle })

// Deep-clone so the store doesn't alias the dialog's mutable local ref
// (the dialog keeps mutating `filters.value` via multi-selects), preserving
// Date instances unlike JSON round-tripping. Hand-rolled instead of
// structuredClone because the selects fill `filters` with reactive store
// proxies (referenceStore items, filtersStore options) and structuredClone
// throws DataCloneError on any nested Proxy — toRaw only unwraps one level.
function deepCloneRaw<T>(value: T): T {
  const raw = toRaw(value) as any
  if (raw instanceof Date) return new Date(raw) as any
  if (Array.isArray(raw)) return raw.map(deepCloneRaw) as any
  if (raw !== null && typeof raw === 'object') {
    const out: Record<string, any> = {}
    for (const key of Object.keys(raw)) out[key] = deepCloneRaw(raw[key])
    return out as T
  }
  return raw
}

function filtersApply() {
  filtersStore.filters = deepCloneRaw(filters.value)
  emit('filtersApply')
  isPopoverOpen.value = false
}

/** Clears this dialog's own controls. Nothing applied changes. */
function filtersReset() {
  filters.value = makeDefaultFilters()
  selectedSavedFilter.value = null
}

/**
 * The Reset button: clear the controls AND what is applied.
 *
 * Clearing the local copy was all this used to do, which made Reset a trap
 * rather than an escape hatch. The store kept the filters already in force — and
 * `filters` is persisted, so they survived every reload — meaning a filter
 * combination the server rejects could only be cleared from devtools. A grouped
 * listing sorted by Most Liked did exactly that.
 *
 * Going through the store's own reset is also the only way to clear
 * `mostLikedMode`, which forces a like ranking regardless of what the sort
 * control shows, and which the dialog cannot see at all.
 */
function filtersResetApply() {
  filtersReset()
  filtersStore.reset()
  emit('filtersApply')
  isPopoverOpen.value = false
}

function filtersChange() {
  if (selectedSavedFilter.value) {
    filters.value = JSON.parse(JSON.stringify(selectedSavedFilter.value.filters))
  }
  for (const date in filters.value.date) {
    if (filters.value.date[date]) {
      filters.value.date[date] = new Date(filters.value.date[date] as Date)
    }
  }
}

async function savedFiltersSave() {
  try {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('User is not authenticated.')
    const id = toSlug(filterName.value)
    if (!id) throw new Error('Filter name must produce a valid ID.')
    await pb.collection('users_filters').create({
      id,
      user: userId,
      name: filterName.value,
      filters: JSON.stringify(filters.value),
    })
    isCreateSavedFilterVisible.value = false
    filterName.value = ''
    await referenceStore.fetchSavedFilters()
    toast.add({ title: 'Saved!', color: 'success', duration: 1000 })
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Filter ID may already be taken. Try a different name.',
      color: 'error',
      duration: 3000,
    })
    console.error('Error saving filter:', error)
  }
}

async function copyFilterLink() {
  if (!selectedSavedFilter.value?.id) return
  const url = `${window.location.origin}/?filter=${selectedSavedFilter.value.id}`
  try {
    await navigator.clipboard.writeText(url)
    toast.add({
      title: 'Copied!',
      description: 'Filter link copied to clipboard.',
      color: 'info',
      duration: 1500,
    })
  } catch (error) {
    console.error('Error copying filter link:', error)
    toast.add({
      title: 'Error',
      description: 'Could not copy the link.',
      color: 'error',
      duration: 3000,
    })
  }
}

async function deleteSavedFilter() {
  if (!selectedSavedFilter.value) {
    toast.add({ title: 'Select a filter first', color: 'warning', duration: 2000 })
    return
  }
  try {
    await pb.collection('users_filters').delete(selectedSavedFilter.value.id)
    selectedSavedFilter.value = null
    await referenceStore.fetchSavedFilters()
    filtersReset()
    toast.add({ title: 'Deleted!', color: 'success', duration: 1500 })
  } catch (error) {
    console.error('Error deleting filter:', error)
    toast.add({
      title: 'Error',
      description: 'Could not delete the filter.',
      color: 'error',
      duration: 3000,
    })
  }
}
</script>

<template>
  <UPopover
    v-model:open="isPopoverOpen"
    :reference="popoverAnchor ?? undefined"
    :dismissible="!isCreateSavedFilterVisible"
    arrow
    :content="{ side: 'bottom', align: 'end', collisionPadding: 8 }"
  >
    <template #content>
      <div class="flex flex-col gap-3 w-110 max-w-[92vw] p-4">
        <!-- Saved filters row -->
        <div class="flex gap-2 items-center">
          <USelectMenu
            v-model="selectedSavedFilter"
            :items="referenceStore.savedFilters"
            label-key="name"
            by="id"
            placeholder="Saved filters..."
            class="flex-1 text-sm"
            @change="filtersChange"
          />
          <UTooltip
            v-if="selectedSavedFilter"
            text="Copy shareable link"
            :content="{ side: 'top' }"
          >
            <UButton
              icon="i-lucide-link"
              color="info"
              variant="ghost"
              class="rounded-full"
              aria-label="Copy shareable link"
              @click="copyFilterLink"
            />
          </UTooltip>
          <UTooltip text="Delete saved filter" :content="{ side: 'top' }">
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              class="rounded-full"
              aria-label="Delete saved filter"
              :disabled="!selectedSavedFilter"
              @click="deleteSavedFilter"
            />
          </UTooltip>
          <UTooltip text="Save current as filter" :content="{ side: 'top' }">
            <UButton
              icon="i-lucide-bookmark"
              color="secondary"
              variant="ghost"
              class="rounded-full"
              aria-label="Save current as filter"
              @click="openCreateSavedFilter"
            />
          </UTooltip>
        </div>

        <USeparator />

        <!-- Main filters.
             multiSelectIdols is the bridge that makes this work: it EXPANDS
             filters.idol + filters.group into a flat idol list on read, and
             collapses fully-selected groups back into filters.group on write.
             The picker itself only ever sees idols, which is why it's the same
             component the upload page and the editors use. -->
        <IdolSelectMenu
          ref="idolMenuRef"
          v-model="multiSelectIdols"
          placeholder="Idols..."
          class="w-full"
        />

        <USelectMenu
          v-model="filters.tag"
          multiple
          by="id"
          :items="referenceStore.tags"
          label-key="name"
          placeholder="Tags..."
          class="w-full"
        >
          <template #default>
            <div v-if="filters.tag?.length" class="flex flex-wrap gap-1">
              <UBadge
                v-for="tag in filters.tag"
                :key="tag.id"
                color="neutral"
                variant="soft"
                class="rounded-full"
              >
                {{ tag.name }}
                <template #trailing>
                  <UIcon
                    name="i-lucide-x"
                    class="cursor-pointer"
                    aria-label="Remove"
                    @pointerdown.stop
                    @click="removeFilterChip('tag', tag.id, $event)"
                  />
                </template>
              </UBadge>
            </div>
            <span v-else class="text-dimmed truncate">Tags...</span>
          </template>
        </USelectMenu>

        <!-- Labels are user-created and unbounded, so unlike Tags this can't bind
             to a preloaded reference list — it searches remotely as you type,
             using the same ignore-filter + external-search pattern the idol
             select already uses. -->
        <USelectMenu
          v-model="filters.label"
          v-model:search-term="labelSearchTerm"
          multiple
          by="slug"
          :items="labelResults"
          :loading="isSearchingLabels"
          ignore-filter
          label-key="name"
          placeholder="Labels..."
          class="w-full"
        >
          <template #default>
            <div v-if="filters.label?.length" class="flex flex-wrap gap-1">
              <UBadge
                v-for="label in filters.label"
                :key="label.slug"
                color="primary"
                variant="outline"
                class="rounded-full"
              >
                {{ label.name }}
                <template #trailing>
                  <UIcon
                    name="i-lucide-x"
                    class="cursor-pointer"
                    aria-label="Remove"
                    @pointerdown.stop
                    @click="removeLabelChip(label.slug, $event)"
                  />
                </template>
              </UBadge>
            </div>
            <span v-else class="text-dimmed truncate">Labels...</span>
          </template>
        </USelectMenu>

        <USelectMenu
          v-model="filters.uploader"
          multiple
          by="id"
          :items="referenceStore.uploaders"
          label-key="name"
          placeholder="Uploaders..."
          class="w-full"
        >
          <template #default>
            <div v-if="filters.uploader?.length" class="flex flex-wrap gap-1">
              <UBadge
                v-for="uploader in filters.uploader"
                :key="uploader.id"
                color="neutral"
                variant="soft"
                class="rounded-full"
              >
                {{ uploader.name }}
                <template #trailing>
                  <UIcon
                    name="i-lucide-x"
                    class="cursor-pointer"
                    aria-label="Remove"
                    @pointerdown.stop
                    @click="removeFilterChip('uploader', uploader.id, $event)"
                  />
                </template>
              </UBadge>
            </div>
            <span v-else class="text-dimmed truncate">Uploaders...</span>
          </template>
        </USelectMenu>

        <!-- Sort + Content Type -->
        <div class="flex gap-3">
          <div class="flex flex-col gap-1.5 flex-1">
            <span class="micro-label text-night-400">Sort by</span>
            <UTabs
              v-model="sortModel"
              :content="false"
              :items="sortTabItems"
              size="xs"
              class="w-full"
            />
          </div>
          <div class="flex flex-col gap-1.5 flex-1">
            <span class="micro-label text-night-400">Content type</span>
            <div class="flex w-full items-center gap-1 rounded-lg bg-elevated p-1">
              <UButton
                v-for="option in filtersStore.contentTypes"
                :key="option.value"
                :label="option.option"
                size="xs"
                :color="isFiletypeSelected(option) ? 'primary' : 'neutral'"
                :variant="isFiletypeSelected(option) ? 'solid' : 'ghost'"
                class="flex-1 justify-center"
                @click="toggleFiletype(option)"
              />
            </div>
          </div>
        </div>

        <!-- Its own row rather than a third column beside Sort/Content type:
             the panel is w-110, which is already tight for two. -->
        <div class="flex flex-col gap-1.5">
          <span class="micro-label text-night-400">Origin</span>
          <div class="flex w-full items-center gap-1 rounded-lg bg-elevated p-1">
            <UButton
              v-for="option in filtersStore.originTypes"
              :key="option.value"
              :label="option.option"
              size="xs"
              :color="isOriginSelected(option) ? 'primary' : 'neutral'"
              :variant="isOriginSelected(option) ? 'solid' : 'ghost'"
              class="flex-1 justify-center"
              @click="toggleOrigin(option)"
            />
          </div>
        </div>

        <!-- Date range + which date field it filters on. The range input
             needs the full panel width (segmented range + calendar button),
             so the Created/Actual toggle lives in the label row. -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between gap-3">
            <span class="micro-label text-night-400">Date range</span>
            <UTabs v-model="dateModeModel" :content="false" :items="dateModeTabItems" size="xs" />
          </div>
          <DateField v-model="dateRangeModel" range class="w-full" />
        </div>

        <USeparator />

        <!-- Actions -->
        <div class="flex gap-2">
          <UButton color="error" variant="outline" label="Reset" block @click="filtersResetApply" />
          <UButton color="success" label="Save & Apply" block @click="filtersApply" />
        </div>
      </div>
    </template>
  </UPopover>

  <!-- Save filter name dialog -->
  <UModal
    v-model:open="isCreateSavedFilterVisible"
    title="Save Filter"
    :ui="{ content: 'sm:max-w-sm' }"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <p class="text-sm text-night-400 leading-relaxed">
          The name becomes a shareable link ID — anyone with the link can apply your filter
          instantly. It must be
          <span class="text-night-200 font-medium">unique across all users</span> and may only
          contain
          <span class="text-night-200 font-medium"
            >lowercase letters, numbers, hyphens, and underscores</span
          >.
        </p>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Filter name</label>
          <UInput v-model="filterName" autocomplete="off" class="w-full" placeholder="my-filter" />
          <span v-if="filterName" class="text-xs text-night-500 mt-0.5">
            <span class="text-night-400">Link:</span>
            {{ `/?filter=${toSlug(filterName) || '—'}` }}
          </span>
          <span v-if="filterName && !toSlug(filterName)" class="text-xs text-red-400 mt-0.5">
            Name must contain at least one valid character.
          </span>
        </div>
      </div>
      <div class="flex gap-3 mt-5">
        <UButton
          label="Cancel"
          color="neutral"
          variant="soft"
          block
          @click="
            () => {
              isCreateSavedFilterVisible = false
            }
          "
        />
        <UButton
          label="Save"
          color="success"
          block
          :disabled="!filterName || !toSlug(filterName)"
          @click="savedFiltersSave"
        />
      </div>
    </template>
  </UModal>
</template>
