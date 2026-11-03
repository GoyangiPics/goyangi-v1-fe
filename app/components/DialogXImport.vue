<script setup lang="ts">
/**
 * Paste X post links, get staged upload files: the Imgur import's dialog, for
 * posts. Each post brings all of its photos and videos; everything after
 * staging is the normal upload flow.
 */
import type { XImportItem, XSkipReason } from '~/composables/useXImport'
import { computed, ref } from 'vue'
import { extractXPostLinks } from '~/utils/xLinks'

const props = defineProps<{
  isVisible: boolean
  /** How many more files the staging area can take. */
  remaining: number
  maxFileSizeMb: number
  /** The selected upload type's dropzone filter. */
  accept: string
  /** Names the type in the hint. */
  typeLabel: string
  /** Items already staged, as xItemKeys, so a second import doesn't duplicate them. */
  staged?: string[]
}>()

const emit = defineEmits<{
  'update:isVisible': [value: boolean]
  imported: [items: XImportItem[]]
}>()

const toast = useToast()
const { isImporting, importedSoFar, importTotal, importLinks } = useXImport()

const rawInput = ref('')

/** Posts, not lines: what extractXPostLinks will actually take. */
const detectedPosts = computed(() => extractXPostLinks(rawInput.value))

const SKIP_LABELS: Record<XSkipReason, string> = {
  dead: 'deleted or not found',
  private: 'from a private account',
  noMedia: 'with no photos or videos',
  type: 'wrong file type',
  size: 'over the size limit',
  network: "couldn't be loaded",
}

async function handleImport() {
  if (!detectedPosts.value.length) return

  const result = await importLinks(rawInput.value, {
    remaining: props.remaining,
    maxFileSizeMB: props.maxFileSizeMb,
    accept: props.accept,
    staged: props.staged,
  })

  if (result.items.length) emit('imported', result.items)

  // One toast for the batch, reasons grouped — the Imgur import's shape.
  const parts: string[] = []
  if (result.items.length) parts.push(`Added ${result.items.length}`)
  if (result.duplicates > 0) parts.push(`${result.duplicates} already added`)
  if (result.overflow > 0) parts.push(`${result.overflow} over the file limit`)
  const byReason = new Map<XSkipReason, number>()
  for (const skip of result.skipped) byReason.set(skip.reason, (byReason.get(skip.reason) ?? 0) + 1)
  for (const [reason, count] of byReason) parts.push(`${count} ${SKIP_LABELS[reason]}`)

  const failed = result.skipped.length + result.overflow + result.duplicates
  toast.add({
    title: result.items.length ? 'X files added' : 'Nothing added',
    description: parts.join(' · '),
    color: result.items.length ? (failed ? 'warning' : 'success') : 'error',
    duration: 4000,
  })

  if (result.items.length) {
    rawInput.value = ''
    emit('update:isVisible', false)
  }
}

function handleHide() {
  emit('update:isVisible', false)
}
</script>

<template>
  <UModal
    :open="isVisible"
    title="Add from X"
    :ui="{ content: 'sm:max-w-xl' }"
    @update:open="emit('update:isVisible', $event)"
  >
    <template #body>
      <p class="text-xs text-night-400 mb-3">
        Paste links to X posts to add every photo and video in them. The post becomes the source,
        and its date the posts' date.
      </p>

      <UTextarea
        v-model="rawInput"
        :rows="5"
        placeholder="https://x.com/…/status/…"
        class="w-full"
        :ui="{ base: 'tools-textarea font-mono text-xs! resize-y' }"
      />

      <div class="flex items-center gap-2 mt-2 mb-4 text-sm font-mono text-night-500">
        <span
          >{{ detectedPosts.length }}
          {{ detectedPosts.length === 1 ? 'post' : 'posts' }} found</span
        >
        <span aria-hidden="true">·</span>
        <span>room for {{ remaining }}</span>
        <span v-if="isImporting" class="ml-auto text-pink-300">
          Fetching {{ importedSoFar }}/{{ importTotal }}…
        </span>
      </div>

      <p class="text-sm text-night-600 mb-4">
        Posts from private accounts won't work. {{ typeLabel }} files only, up to
        {{ maxFileSizeMb }}MB each — a video over that comes in at a smaller size if X has one.
      </p>

      <div class="flex gap-3">
        <UButton label="Cancel" color="neutral" block @click="handleHide" />
        <UButton
          label="Add files"
          color="success"
          block
          :loading="isImporting"
          :disabled="!detectedPosts.length || remaining < 1"
          @click="handleImport"
        />
      </div>
    </template>
  </UModal>
</template>
