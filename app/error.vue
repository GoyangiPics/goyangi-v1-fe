<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  error: {
    statusCode: number
    statusMessage?: string
    message?: string
  }
}>()

const isNotFound = computed(() => props.error.statusCode === 404)
const title = computed(() => (isNotFound.value ? 'Page not found' : 'Something went wrong'))
const description = computed(() =>
  isNotFound.value
    ? `We couldn't find what you're looking for.`
    : props.error.statusMessage || props.error.message || 'Please try again later.',
)

useSeoMeta({
  title: title.value,
  robots: 'noindex',
})

function handleError() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div class="dark min-h-dvh flex flex-col items-center justify-center px-6 text-center">
    <img
      src="~/assets/background.svg"
      alt=""
      class="w-full h-62.5 absolute top-0 left-0 z-[-1] transform rotate-180 opacity-50"
    />

    <p class="text-7xl font-bold font-display text-pink-400 mb-4">
      {{ error.statusCode }}
    </p>
    <h1 class="text-2xl font-semibold text-night-100 mb-2">
      {{ title }}
    </h1>
    <p class="text-sm text-night-400 max-w-md mb-8">
      {{ description }}
    </p>

    <UButton
      label="Back to home"
      icon="i-lucide-house"
      color="neutral"
      variant="outline"
      @click="handleError"
    />
  </div>
</template>
