<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// Shown by app.vue in place of the whole app while the backend is unreachable.
// Keeps checking on its own and reloads once the backend answers, so a tab
// left open comes back without the reader doing anything. A reload rather than
// just clearing the flag: every page that failed while it was down is holding
// an empty or half-loaded state.
const { check } = useBackendStatus()

const RETRY_MS = 15_000
const isChecking = ref(false)
const isOffline = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

useSeoMeta({ title: 'Down for maintenance', robots: 'noindex' })

async function retry() {
  // Offline is the reader's connection, not ours — say so instead of blaming
  // the server, and don't bother pinging.
  isOffline.value = !navigator.onLine
  if (isOffline.value || isChecking.value) return
  isChecking.value = true
  const up = await check()
  if (up) window.location.reload()
  else isChecking.value = false
}

onMounted(() => {
  isOffline.value = !navigator.onLine
  timer = setInterval(retry, RETRY_MS)
  window.addEventListener('online', retry)
})

onBeforeUnmount(() => {
  clearInterval(timer)
  window.removeEventListener('online', retry)
})
</script>

<template>
  <div class="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
    <p class="text-7xl mb-4" aria-hidden="true">🐱</p>
    <h1 class="text-2xl font-semibold font-display text-night-100 mb-2">
      {{ isOffline ? `You're offline` : 'Down for maintenance' }}
    </h1>
    <p class="text-sm text-night-400 max-w-md mb-8">
      {{
        isOffline
          ? `Check your connection. This page will reload when you're back online.`
          : `We'll be back soon. This page will reload by itself.`
      }}
    </p>

    <UButton
      label="Try again"
      icon="i-lucide-refresh-cw"
      color="neutral"
      variant="outline"
      :loading="isChecking"
      @click="retry"
    />
  </div>
</template>
