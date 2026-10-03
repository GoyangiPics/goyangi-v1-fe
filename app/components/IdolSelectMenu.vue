<script setup lang="ts">
import type { Idol } from '~/types/appTypes'
import { computed } from 'vue'

/**
 * The idol picker: a multi-select with idols grouped under their group, a
 * tri-state header that toggles a whole group, and search that keeps headers
 * attached to their surviving members.
 *
 * There were four of these. The upload page hand-rolled the whole thing
 * (grouping, header injection, toggle) without ever adopting
 * useGroupedIdolSelection; the filter dialog used the composable; and the two
 * per-record editors — the clip editor and set edit — had a degraded FLAT
 * `USelectMenu` with no grouping at all, which is unusable once the directory
 * has more than a handful of idols.
 *
 * Not a consumer, and shouldn't be: DialogManageStars renders its own expanded
 * checkbox list rather than a dropdown, and its selection lives in the stars
 * store rather than a v-model. It uses the composable directly, which is right.
 *
 * Groups are never picked here — they're derived from the chosen idols. See
 * inferGroups.
 */
const props = withDefaults(
  defineProps<{
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    placeholder?: string
    color?: 'error' | 'primary' | 'neutral'
    highlight?: boolean
    /**
     * Show a fully-selected group as one chip instead of N idol chips. Display
     * only — the model always holds individual idols.
     */
    collapseChips?: boolean
  }>(),
  {
    placeholder: 'Select idols...',
    collapseChips: true,
  },
)

const model = defineModel<any[]>({ default: () => [] })

const referenceStore = useReferenceStore()

const { searchTerm, filteredGroups, groupCheckState } = useGroupedIdolSelection(
  () => model.value,
  () => referenceStore.idols,
  () => referenceStore.groups,
)

function isSelected(item: { id: string }) {
  return model.value.some((s: any) => s.id === item.id)
}

function toggleGroup(items: Idol[]) {
  const allSelected = items.every((item) => isSelected(item))
  if (allSelected) {
    model.value = model.value.filter((s: any) => !items.some((item) => item.id === s.id))
  } else {
    const toAdd = items.filter((item) => !isSelected(item))
    model.value = [...model.value, ...toAdd]
  }
}

/**
 * Each group becomes [header, ...members]. The header is a normal-looking item
 * whose onSelect prevents the default selection and toggles the group instead.
 *
 * Filtering happens here rather than in USelectMenu (hence `ignore-filter`) so
 * headers stay attached to their filtered members — the built-in search drops
 * the headers and leaves indistinguishable same-named idols.
 */
const items = computed<any[]>(() => {
  const out: any[] = []
  for (const group of filteredGroups.value) {
    out.push({
      id: `__group__${group.gid}`,
      name: group.label,
      groupName: group.label,
      groupHeader: true,
      groupItems: group.items,
      onSelect: (e: Event) => {
        e.preventDefault()
        toggleGroup(group.items)
      },
    })
    out.push(...group.items)
  }
  return out
})

const chips = computed(() =>
  props.collapseChips
    ? collapseIdolSelection(model.value as Idol[], referenceStore.idols, referenceStore.groups)
    : model.value.map((idol: any) => ({ key: `idol-${idol.id}`, label: idol.name, idol })),
)

/**
 * The search term survives selection and blur on purpose (see the two
 * reset-search-term props), so a consumer that reopens in a fresh context —
 * the filter popover — has to clear it explicitly.
 */
function clearSearch() {
  searchTerm.value = ''
}

defineExpose({ clearSearch })

function removeChip(chip: any, event: Event) {
  event.stopPropagation()
  // A group chip stands for every one of its members, so it removes all of them.
  if (chip.groupId) {
    model.value = model.value.filter((i: any) => i.group !== chip.groupId)
  } else {
    model.value = model.value.filter((i: any) => i.id !== chip.idol.id)
  }
}
</script>

<template>
  <USelectMenu
    v-model="model"
    v-model:search-term="searchTerm"
    multiple
    by="id"
    ignore-filter
    :reset-search-term-on-select="false"
    :reset-search-term-on-blur="false"
    :items="items"
    label-key="name"
    :size="size"
    :color="color"
    :highlight="highlight"
  >
    <template #default>
      <div v-if="chips.length" class="flex flex-wrap gap-1">
        <UBadge
          v-for="chip in chips"
          :key="chip.key"
          color="neutral"
          variant="soft"
          class="rounded-full"
        >
          {{ chip.label }}
          <template #trailing>
            <UIcon
              name="i-lucide-x"
              class="size-3.5 shrink-0 cursor-pointer"
              @click.stop="removeChip(chip, $event)"
            />
          </template>
        </UBadge>
      </div>
      <span v-else class="text-dimmed">{{ placeholder }}</span>
    </template>

    <template #item="{ item }">
      <div v-if="(item as any).groupHeader" class="flex items-center gap-2 select-none">
        <UCheckbox
          class="pointer-events-none"
          :model-value="groupCheckState((item as any).groupItems)"
        />
        <span class="font-semibold text-night-200 text-sm">{{ (item as any).name }}</span>
      </div>
      <div v-else class="flex items-center gap-2 pl-6">
        <UCheckbox class="pointer-events-none" :model-value="isSelected(item as any)" />
        <span>{{ (item as any).name }}</span>
      </div>
    </template>
  </USelectMenu>
</template>
