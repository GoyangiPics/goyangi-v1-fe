<script setup lang="ts">
import type { Group } from '~/types/appTypes'

const emit = defineEmits(['filtersApply'])

const filtersDialog = ref()

const filtersStore = useFiltersStore()
const referenceStore = useReferenceStore()
const avatar = useAvatarUrl()

const { searchValue } = storeToRefs(filtersStore)

const ORIGIN_ICONS: Record<string, string> = {
  direct: 'i-lucide-upload',
  imgur: 'i-simple-icons-imgur',
  discord: 'i-simple-icons-discord',
}

interface ActiveChip {
  key: string
  label: string
  icon: string
  avatarUrl?: string | null
  severity: 'warning' | 'info' | 'secondary' | 'success' | 'contrast' | 'danger'
  remove: () => void
}

/** Old PrimeVue severities → Nuxt UI badge colors. */
const severityColor = {
  warning: 'warning',
  info: 'info',
  secondary: 'neutral',
  success: 'success',
  contrast: 'neutral',
  danger: 'error',
} as const

const activeChips = computed<ActiveChip[]>(() => {
  const chips: ActiveChip[] = []
  const f = filtersStore.filters

  // Idol chips, with fully-selected groups collapsed to one group chip.
  for (const c of collapseIdolSelection(
    f.idol ?? [],
    referenceStore.idols,
    referenceStore.groups,
  )) {
    chips.push(
      c.groupId
        ? {
            key: `group-compressed-${c.groupId}`,
            label: c.label,
            icon: 'i-lucide-at-sign',
            severity: 'info',
            remove: () => {
              filtersStore.filters.idol = f.idol.filter((i) => i.group !== c.groupId)
            },
          }
        : {
            key: c.key,
            label: c.label,
            icon: 'i-lucide-star',
            severity: 'warning',
            remove: () => {
              filtersStore.filters.idol = f.idol.filter((i) => i.id !== c.idol!.id)
            },
          },
    )
  }
  f.group?.forEach((item: Group) => {
    chips.push({
      key: `group-${item.id}`,
      label: item.name,
      icon: 'i-lucide-at-sign',
      severity: 'info',
      remove: () => {
        filtersStore.filters.group = f.group.filter((g) => g.id !== item.id)
      },
    })
  })
  f.tag?.forEach((item) => {
    chips.push({
      key: `tag-${item.id}`,
      label: item.name,
      icon: 'i-lucide-tags',
      severity: 'secondary',
      remove: () => {
        filtersStore.filters.tag = f.tag.filter((i) => i.id !== item.id)
      },
    })
  })
  f.uploader?.forEach((item) => {
    chips.push({
      key: `uploader-${item.id}`,
      label: item.name,
      icon: 'i-lucide-user',
      avatarUrl: avatar.forUploader(item),
      severity: 'success',
      remove: () => {
        filtersStore.filters.uploader = f.uploader.filter((i) => i.id !== item.id)
      },
    })
  })
  f.filetype?.forEach((item) => {
    chips.push({
      key: `filetype-${item.value}`,
      label: item.option,
      icon: item.value === 'video' ? 'i-lucide-video' : 'i-lucide-image',
      severity: 'contrast',
      remove: () => {
        filtersStore.filters.filetype = f.filetype.filter((i) => i.value !== item.value)
      },
    })
  })
  f.label?.forEach((item) => {
    chips.push({
      key: `label-${item.slug}`,
      label: item.name,
      icon: 'i-lucide-tag',
      severity: 'secondary',
      remove: () => {
        filtersStore.filters.label = f.label.filter((i) => i.slug !== item.slug)
      },
    })
  })
  // Optional-chained like the others: a session persisted before `origin`
  // existed reaches here on first render, ahead of the store's afterHydrate.
  f.origin?.forEach((item) => {
    chips.push({
      key: `origin-${item.value}`,
      label: item.option,
      icon: ORIGIN_ICONS[item.value] ?? 'i-lucide-upload',
      severity: 'success',
      remove: () => {
        filtersStore.filters.origin = f.origin.filter((i) => i.value !== item.value)
      },
    })
  })
  if (!filtersStore.mostLikedMode && f.date && f.date.length > 0 && f.date[0]) {
    const start = (f.date[0] as Date).toISOString().split('T')[0]
    const end = f.date[1] ? (f.date[1] as Date).toISOString().split('T')[0] : start
    chips.push({
      key: 'date',
      label: start === end ? start! : `${start} → ${end}`,
      icon: 'i-lucide-calendar',
      severity: 'secondary',
      remove: () => {
        filtersStore.filters.date = []
        filtersStore.mostLikedMode = null
      },
    })
  }
  if (!filtersStore.mostLikedMode && f.sort && f.sort.value && f.sort.value !== 'recent') {
    // Label from the store's list rather than the persisted copy, so a label
    // renamed since it was saved still shows its current wording.
    const sortValue = f.sort.value
    chips.push({
      key: `sort-${sortValue}`,
      label: filtersStore.sortType.find((o) => o.value === sortValue)?.option ?? f.sort.option,
      icon: 'i-lucide-arrow-down-wide-narrow',
      severity: 'contrast',
      remove: () => {
        filtersStore.filters.sort = filtersStore.sortType[0] ?? null
        filtersStore.mostLikedMode = null
      },
    })
  }
  // It changes what Newest/Oldest and the date range mean even with neither
  // touched, so it gets a chip of its own rather than riding on theirs.
  if (!filtersStore.mostLikedMode && f.dateMode?.value === 'actual') {
    chips.push({
      key: 'datemode-actual',
      label: 'By actual date',
      icon: 'i-lucide-calendar-clock',
      severity: 'contrast',
      remove: () => {
        filtersStore.filters.dateMode = filtersStore.dateMode[0] ?? null
      },
    })
  }

  return chips
})

function removeChip(chip: ActiveChip) {
  chip.remove()
  emit('filtersApply')
}

function filtersReset() {
  filtersStore.reset()
  emit('filtersApply')
}

function filtersApply() {
  // searchValue is reactive on the store and persisted automatically.
  emit('filtersApply')
}
</script>

<template>
  <div class="mx-auto my-2 flex">
    <div
      class="filter-input-wrapper relative flex-1 flex items-center flex-wrap gap-1.5 pl-10 pr-2 py-1 min-h-8"
    >
      <UIcon
        name="i-lucide-search"
        class="absolute top-1/2 -translate-y-1/2 left-3 text-night-400 dark:text-night-600"
      />
      <UBadge
        v-for="chip in activeChips"
        :key="chip.key"
        :color="severityColor[chip.severity]"
        :variant="chip.severity === 'contrast' ? 'solid' : 'soft'"
        class="select-none shrink-0"
      >
        <span class="flex items-center gap-1.5">
          <img
            v-if="chip.avatarUrl"
            :src="chip.avatarUrl"
            class="w-3.5 h-3.5 rounded-full object-cover shrink-0"
            :alt="chip.label"
          />
          <UIcon v-else :name="chip.icon" class="text-xs" />
          <span>{{ chip.label }}</span>
          <button
            type="button"
            class="ml-1 flex items-center justify-center hover:opacity-70 cursor-pointer"
            aria-label="Remove filter"
            @click.stop="removeChip(chip)"
          >
            <UIcon name="i-lucide-x" class="text-xs" />
          </button>
        </span>
      </UBadge>
      <input
        v-model="searchValue"
        type="text"
        placeholder="Search titles…"
        class="filter-input flex-1 min-w-30 bg-transparent outline-none border-0 text-sm py-1"
        @keyup.enter="filtersApply"
      />
      <div class="ml-auto flex items-center gap-0.5 shrink-0">
        <button
          v-if="filtersStore.isFilterSet"
          type="button"
          class="flex items-center justify-center w-6 h-6 rounded-full text-red-400 hover:bg-red-900/40 transition-colors cursor-pointer"
          aria-label="Clear filters"
          @click.stop="filtersReset"
        >
          <UIcon name="i-lucide-x" class="text-xs" />
        </button>
        <button
          type="button"
          class="flex items-center justify-center w-7 h-7 rounded-md transition-colors cursor-pointer"
          :class="
            filtersStore.isFilterSet
              ? 'text-blue-400 hover:bg-blue-900/30'
              : 'text-night-400 hover:bg-night-700/50'
          "
          aria-label="Filters"
          @click.stop="filtersDialog?.toggle($event)"
        >
          <UIcon name="i-lucide-filter" class="text-sm" />
        </button>
      </div>
    </div>
    <UButton
      label="Search"
      class="ml-2 w-36 justify-center"
      color="neutral"
      variant="solid"
      @click="filtersApply"
    />
  </div>

  <DialogBaseFilters ref="filtersDialog" @filters-apply="emit('filtersApply')" />
</template>

<!-- .filter-input-wrapper / .filter-input are shared with the uploaders page
     and live in app/assets/main.css. -->
