<script setup lang="ts">
interface NavLead {
  label: string
  icon: string
  path: string
  /** Use the amber "Saved" styling instead of the default outline. */
  amber?: boolean
  /** Route that marks the lead button as active. */
  activePath?: string
}

interface NavTab {
  path: string
  icon?: string
  /** Extra classes for the tab icon (e.g. `icon-filled`). */
  iconClass?: string
  label: string
}

defineProps<{
  lead: NavLead
  tabs: NavTab[]
}>()

const { isMobile } = useWindowSize()
const route = useRoute()
// Links carry the active filters to pages that consume them — see useNavTarget.
const { to } = useNavTarget()

const currentPath = computed(() => route.path)
</script>

<template>
  <div class="flex items-stretch gap-2 w-full">
    <UButton
      class="nav-pill-outline"
      :class="[
        lead.amber ? 'nav-pill-outline-amber' : '',
        lead.activePath && currentPath === lead.activePath ? 'nav-pill-outline-active' : '',
      ]"
      :to="to(lead.path)"
    >
      <UIcon :name="lead.icon" />
      <span v-if="!isMobile">{{ lead.label }}</span>
    </UButton>

    <NavigationTabGroup :tabs="tabs" />
  </div>
</template>
