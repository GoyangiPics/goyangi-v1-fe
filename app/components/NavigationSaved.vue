<script setup lang="ts">
const lead = { label: 'Home', icon: 'i-lucide-house', path: '/' }

// Feed first: it's the page you'd land on once you've starred anything.
const tabs = [
  { path: '/me/feed', icon: 'i-lucide-star', label: 'My Feed' },
  { path: '/me/likes', icon: 'i-lucide-heart', iconClass: 'icon-filled', label: 'My Likes' },
  { path: '/me/collections', icon: 'i-lucide-folder', label: 'My Collections' },
]
</script>

<template>
  <NavigationBar :lead="lead" :tabs="tabs" />
</template>
