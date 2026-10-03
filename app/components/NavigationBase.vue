<script setup lang="ts">
const lead = {
  label: 'Saved',
  icon: 'i-lucide-bookmark',
  path: '/me/likes',
  amber: true,
  activePath: '/me/likes',
}

// Five is the practical ceiling here; NavigationTabGroup hides labels on mobile,
// so it degrades to five icons rather than five words.
//
// /labels is deliberately absent: labels are meant to be added in passing from
// the context menu and consumed as a filter, so a top-level tab would advertise
// them as a bigger feature than they are. The browse page still exists and is
// reachable from the avatar menu under App.
const tabs = [
  { path: '/', icon: 'i-lucide-house', label: 'Home' },
  { path: '/collections', icon: 'i-lucide-folder', label: 'Collections' },
  { path: '/stickers', icon: 'i-lucide-smile', label: 'Stickers' },
  { path: '/uploaders', icon: 'i-lucide-users', label: 'Uploaders' },
]
</script>

<template>
  <NavigationBar :lead="lead" :tabs="tabs" />
</template>
