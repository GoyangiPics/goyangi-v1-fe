<script setup lang="ts">
const lead = { label: 'Home', icon: 'i-lucide-house', path: '/' }

// Sets sit with uploads rather than under Saved: they're produced by uploading,
// not curated like likes and collections.
const tabs = [
  { path: '/me/uploads', icon: 'i-lucide-square-pen', label: 'My Uploads' },
  { path: '/me/sets', icon: 'i-lucide-film', label: 'My Sets' },
  { path: '/uploads', icon: 'i-lucide-cloud-upload', label: 'New Upload' },
]
</script>

<template>
  <NavigationBar :lead="lead" :tabs="tabs" />
</template>
