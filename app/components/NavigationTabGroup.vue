<script setup lang="ts">
interface Tab {
  path: string
  icon?: string
  /** Extra classes for the tab icon (e.g. `icon-filled`). */
  iconClass?: string
  label: string
}

const props = defineProps<{
  tabs: Tab[]
}>()

const { isMobile } = useWindowSize()
const route = useRoute()
// Through useNavTarget so a filter applied on home follows into Collections,
// and nothing follows into a page that can't apply it.
const { to } = useNavTarget()

const currentPath = computed(() => route.path)
</script>

<template>
  <div class="flex-1 flex items-stretch gap-1.5 bg-night-800 nav-container">
    <!-- Real links, not buttons with a router.push: middle-click, ctrl-click and
         "open in new tab" all work, and the URL shows on hover. -->
    <NuxtLink
      v-for="tab in props.tabs"
      :key="tab.path"
      :to="to(tab.path)"
      class="nav-tab flex-1"
      :class="currentPath === tab.path ? 'nav-tab-active' : 'nav-tab-inactive'"
    >
      <UIcon v-if="tab.icon" :name="tab.icon" mode="svg" :class="tab.iconClass" />
      <span v-else class="text-sm leading-none">{{ tab.label }}</span>
      <span v-if="tab.icon && !isMobile">{{ tab.label }}</span>
    </NuxtLink>
  </div>
</template>
