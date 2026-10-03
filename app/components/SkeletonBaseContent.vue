<script setup lang="ts"></script>

<template>
  <div class="py-2 px-2 surface-card relative">
    <div class="flex items-center gap-1 mb-2">
      <!-- Heights track the real card footer: 32px avatar row, 24px chips. -->
      <USkeleton class="w-full h-8 flex-1" />
      <div class="flex-shrink-0 flex gap-2">
        <USkeleton class="rounded-full size-8" />
      </div>
    </div>
    <USkeleton class="w-full h-[360px] rounded-md" />
    <div class="flex justify-between mt-0.4">
      <div class="flex flex-wrap flex-1">
        <USkeleton class="w-20 h-6 mr-2 mt-2" />
        <USkeleton class="w-20 h-6 mr-2 mt-2" />
      </div>
      <div class="mt-2">
        <USkeleton class="w-24 h-6" />
      </div>
    </div>
  </div>
</template>
