<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  content: any
}>()

const toast = useToast()
const filtersStore = useFiltersStore()
const referenceStore = useReferenceStore()
const loaded = ref(false)

async function copyAndNotify() {
  const url = props.content.preview
  if (!url) {
    toast.add({
      title: 'Sticker not ready yet',
      color: 'warning',
      duration: 2000,
    })
    return
  }
  await navigator.clipboard.writeText(url)
  toast.add({
    title: 'Link copied',
    color: 'info',
    duration: 1000,
  })
}

function applyFilter(value: any, type: 'idol' | 'group' | 'uploader') {
  filtersStore.reset()
  if (type === 'idol') {
    const idol = referenceStore.idols.find((i: any) => i.name === value.name)
    if (idol) filtersStore.filters.idol.push(idol)
  } else if (type === 'group') {
    const group = referenceStore.groups.find((g: any) => g.name === value.name)
    if (group) filtersStore.filters.group.push(group)
  }
}
</script>

<template>
  <div v-show="loaded">
    <div class="p-2 surface-card w-54">
      <!-- Title row -->
      <div class="flex items-center gap-3 mb-1.5 min-w-0">
        <NuxtLink :to="`/single/${content.id}`" class="flex-1 min-w-0 truncate">
          <UTooltip :text="content.title" :content="{ side: 'top' }">
            <h3 class="text-xs font-medium hover:text-violet-400 truncate">
              {{ content.title }}
            </h3>
          </UTooltip>
        </NuxtLink>
        <div v-if="content.expand?.uploader" class="shrink-0 flex items-center">
          <UploaderChip
            :uploader="content.expand.uploader"
            @click="applyFilter(content.expand.uploader, 'uploader')"
          />
        </div>
      </div>

      <!-- Sticker image -->
      <div
        class="relative group cursor-pointer rounded-md overflow-hidden w-50 h-50"
        @click="copyAndNotify"
      >
        <img
          :src="content.preview"
          :alt="content.title"
          class="w-full h-full object-cover"
          @load="loaded = true"
        />
        <!-- Copy overlay on hover -->
        <div
          class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        >
          <UIcon name="i-lucide-copy" class="text-white text-xl" />
        </div>
      </div>

      <!-- Idol / group tags -->
      <div class="flex flex-wrap gap-1 mt-1.5">
        <UBadge
          v-for="idol in content.expand?.idol"
          :key="idol.id"
          icon="i-lucide-star"
          color="warning"
          variant="soft"
          :label="idol.name"
          class="select-none cursor-pointer hover:bg-amber-900! text-xs! py-0.5! px-1.5!"
          @click="applyFilter(idol, 'idol')"
        />
        <UBadge
          v-for="group in content.expand?.group"
          :key="group.id"
          icon="i-lucide-at-sign"
          color="info"
          variant="soft"
          :label="group.name"
          class="select-none cursor-pointer hover:bg-blue-900! text-xs! py-0.5! px-1.5!"
          @click="applyFilter(group, 'group')"
        />
      </div>
    </div>
  </div>
  <div v-if="!loaded">
    <div class="w-54 surface-card p-2">
      <USkeleton class="w-full h-4 mb-1.5" />
      <USkeleton class="w-50 h-50 rounded-md" />
      <div class="flex gap-1 mt-1.5">
        <USkeleton class="w-[60px] h-5" />
        <USkeleton class="w-[60px] h-5" />
      </div>
    </div>
  </div>
</template>
