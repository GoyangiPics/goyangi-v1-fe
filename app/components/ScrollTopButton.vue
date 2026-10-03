<script setup lang="ts">
/** Replacement for PrimeVue's ScrollTop: fades in after scrolling down. */
const { y } = useWindowScroll()
const visible = computed(() => y.value > 400)

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <Transition name="scroll-top">
    <UButton
      v-if="visible"
      icon="i-lucide-arrow-up"
      color="primary"
      square
      size="lg"
      aria-label="Scroll to top"
      class="fixed bottom-5 right-5 z-50 rounded-full shadow-lg"
      @click="scrollToTop"
    />
  </Transition>
</template>

<style scoped>
.scroll-top-enter-active,
.scroll-top-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.scroll-top-enter-from,
.scroll-top-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
