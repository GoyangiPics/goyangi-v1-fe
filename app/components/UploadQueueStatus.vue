<script setup lang="ts">
/**
 * "There are 28 gifs ahead of yours."
 *
 * The backend encodes one file at a time, so a batch dropped while someone
 * else's 20 are still going sits untouched for a long while. Nothing said so —
 * the results panel showed "processing" and the uploader had no way to tell a
 * queue from a stall, which is what made a slow encode read as a broken one.
 *
 * All the arithmetic lives in ~/utils/uploadQueue, where it's unit-tested; this
 * is the presentation over it.
 */
import { computed } from 'vue'

const props = defineProps<{
  snapshot: UploadQueueSnapshot | null
  /** Files picked but not yet uploaded — they'd go in behind everything below. */
  stagedCount: number
  /** This uploader's own items already in the queue, so they aren't counted as a wait. */
  mineInQueue: number
}>()

const q = computed(() => describeQueue(props.snapshot, props.stagedCount, props.mineInQueue))
</script>

<template>
  <div
    v-if="q.visible"
    class="flex flex-col gap-1 px-3 py-2 rounded-lg border text-sm"
    :class="q.isBusy ? 'border-amber-400/25 bg-amber-400/5' : 'border-white/8 bg-white/3'"
  >
    <div class="flex items-center gap-2 flex-wrap">
      <UIcon
        :name="q.isBusy ? 'i-lucide-hourglass' : 'i-lucide-circle-check'"
        :class="q.isBusy ? 'text-amber-400' : 'text-emerald-400'"
      />
      <span class="font-medium" :class="q.isBusy ? 'text-amber-200' : 'text-night-300'">
        <template v-if="q.isBusy">{{ q.total }} in the queue</template>
        <template v-else>No queue. Your upload starts right away.</template>
      </span>
      <span v-if="q.breakdown" class="text-night-500 font-mono">{{ q.breakdown }}</span>
    </div>

    <p v-if="q.isBusy" class="text-night-500 font-mono pl-6">
      {{ q.active }} processing now · {{ q.capacityLabel }}
      <span v-if="q.mine > 0" class="text-night-400">
        · {{ q.mine }} of them {{ q.mine === 1 ? 'is' : 'are' }} yours
      </span>
    </p>

    <!-- The actual point of the row while staging: what clicking Upload buys you. -->
    <p v-if="stagedCount > 0 && q.others > 0" class="text-amber-200/80 pl-6">
      Your {{ q.stagedLabel }} will wait behind {{ q.others }}
      {{ q.others === 1 ? 'other' : 'others' }}.
    </p>
  </div>
</template>
