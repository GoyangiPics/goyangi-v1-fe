<script setup lang="ts">
// Page titles read "Winter - Aespa · goyangi"; the bare site name only where a
// page set nothing. A function because nuxt.config's head is serialised, and
// the string form there ('goyangi', no %s) had been overwriting every title.
useHead({
  titleTemplate: (title) => (title && title !== 'goyangi' ? `${title} · goyangi` : 'goyangi'),
})

// Set by the PocketBase plugin once a health check confirms the backend is
// unreachable. The page isn't rendered at all then, so nothing sits on a
// spinner or fires requests that can only fail.
const { isDown: isBackendDown } = useBackendStatus()
</script>

<template>
  <!-- delayDuration 0 matches PrimeVue's v-tooltip (instant on hover). -->
  <UApp :toaster="{ position: 'top-right' }" :tooltip="{ delayDuration: 0 }">
    <img
      src="~/assets/background.svg"
      alt="Background"
      class="w-full h-62.5 absolute top-0 left-0 z-[-1] transform rotate-180 opacity-50"
    />
    <NuxtLoadingIndicator />
    <NuxtRouteAnnouncer />
    <BackendMaintenance v-if="isBackendDown" />
    <template v-else>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
      <ScrollTopButton />
      <!-- ClientOnly: gated on canUpload, which is client-only auth state, and
           /set/** and /single/** are server-rendered. -->
      <ClientOnly>
        <UploadFab />
      </ClientOnly>
    </template>
  </UApp>
</template>
