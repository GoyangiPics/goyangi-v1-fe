<script setup lang="ts">
import type { Uploader } from '~/types/appTypes'

// `isFeatured` is not in the PocketBase schema — it's an optional runtime
// flag the API may attach. Typed here so the template can read it safely.
const props = defineProps<{
  uploader: Uploader & { isFeatured?: boolean }
}>()

const emit = defineEmits<{
  click: [uploader: Uploader]
}>()

const avatar = useAvatarUrl()
const avatarUrl = computed(() => avatar.forUploader(props.uploader))
</script>

<template>
  <UBadge
    :color="uploader.isFeatured ? 'warning' : 'success'"
    variant="soft"
    class="rounded-full select-none cursor-pointer !py-0.5 !pl-0.5 !pr-2"
    :class="uploader.isFeatured ? 'hover:bg-yellow-900!' : 'hover:bg-green-900!'"
    @click="emit('click', uploader)"
  >
    <span class="flex items-center gap-1.5">
      <UAvatar v-if="avatarUrl" :src="avatarUrl" class="!w-6 !h-6 -ml-1 shrink-0" />
      <UIcon
        v-else
        :name="uploader.isFeatured ? 'i-lucide-crown' : 'i-lucide-user'"
        class="text-xs"
      />
      <span>{{ uploader.name }}</span>
    </span>
  </UBadge>
</template>
