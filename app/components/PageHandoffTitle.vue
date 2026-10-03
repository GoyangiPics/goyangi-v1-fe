<script setup lang="ts">
/** Renders the handed-off set/collection title (see usePageTitleHandoff). */
const { pageTitle } = usePageTitleHandoff()
</script>

<template>
  <div v-if="pageTitle" class="flex justify-center items-center mb-2">
    <h1 class="text-2xl text-violet-400">
      {{ pageTitle }}
    </h1>
  </div>
</template>
