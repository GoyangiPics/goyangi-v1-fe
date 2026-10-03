<script setup lang="ts">
/**
 * Floating shortcut to /uploads for people who can actually upload.
 *
 * /uploads was three levels deep: reachable only from NavigationUploads, which
 * renders only on /uploads and /me/uploads, and /me/uploads only from the header
 * avatar menu — for the one action uploaders do most.
 *
 * Not a canUpload-gated tab in NavigationBase, which would be the obvious
 * place: NavigationBase renders on /set/[id], and /set/** and /single/** are the
 * two SSR'd route groups. canUpload lives in client-only auth state (PocketBase
 * tokens are in localStorage and the server instance has no user — see the
 * ClientOnly around the avatar menu in Header.vue), so a gated tab there would
 * hydration-mismatch on exactly the two SEO-relevant routes.
 */
const authStore = useAuthStore()
const route = useRoute()

// Hidden on the upload page itself, and on the sibling tab where the "New
// Upload" tab is already right there.
const visible = computed(
  () => authStore.canUpload && route.path !== '/uploads' && route.path !== '/me/uploads',
)
</script>

<template>
  <Transition name="upload-fab">
    <UButton
      v-if="visible"
      to="/uploads"
      icon="i-lucide-cloud-upload"
      color="primary"
      square
      size="lg"
      aria-label="New upload"
      title="New upload"
      class="fixed bottom-20 right-5 z-50 rounded-full shadow-lg"
    />
  </Transition>
</template>

<style scoped>
/* Stacks above ScrollTopButton, which owns bottom-5 right-5 z-50. */
.upload-fab-enter-active,
.upload-fab-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.upload-fab-enter-from,
.upload-fab-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
</style>
