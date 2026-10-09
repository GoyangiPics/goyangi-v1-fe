<script setup lang="ts">
const lead = { label: 'Home', icon: 'i-lucide-house', path: '/' }

// Sets sit with uploads rather than under Saved: they're produced by uploading,
// not curated like likes and collections.
const tabs = [
  { path: '/me/uploads', icon: 'i-lucide-square-pen', label: 'My uploads' },
  { path: '/me/sets', icon: 'i-lucide-film', label: 'My sets' },
  { path: '/uploads', icon: 'i-lucide-cloud-upload', label: 'New upload' },
]
</script>

<template>
  <NavigationBar :lead="lead" :tabs="tabs" />
</template>
