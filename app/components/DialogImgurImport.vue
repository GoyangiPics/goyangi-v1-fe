<script setup lang="ts">
/**
 * Paste imgur links, get staged upload files.
 *
 * A dialog rather than a panel on the page because the dropzone's layout is
 * already load-bearing (see the #leading comment in uploads.vue) and this is a
 * second, occasional way IN to the same staging area — not a second dropzone.
 * Everything after staging is the normal upload flow: metadata, destination,
 * set matching, the lot.
 */
import type { ImgurImportItem, ImgurSkipReason } from '~/composables/useImgurImport'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  isVisible: boolean
  /** How many more files the staging area can take. */
  remaining: number
  maxFileSizeMb: number
  /** The selected upload type's dropzone filter. */
  accept: string
  /** Names the type in the mismatch message. */
  typeLabel: string
  /** Links already staged, so a second import doesn't duplicate them. */
  staged?: string[]
  /** Prefilled links — the handoff from the Imgur Tools page. */
  initialLinks?: string
}>()

const emit = defineEmits<{
  'update:isVisible': [value: boolean]
  imported: [items: ImgurImportItem[]]
}>()

const toast = useToast()
const { isImporting, importedSoFar, importTotal, importLinks } = useImgurImport()

const rawInput = ref(props.initialLinks ?? '')

// The prop can arrive after mount: the page reads the handoff in onMounted and
// opens this dialog in the same tick.
watch(
  () => props.initialLinks,
  (value) => {
    if (value) rawInput.value = value
  },
)

/** What extractImgurLinks would actually take — not a line count. */
const detectedLinks = computed(() => extractImgurLinks(rawInput.value))

const SKIP_LABELS: Record<ImgurSkipReason, string> = {
  dead: 'gone from imgur',
  type: 'wrong kind of file',
  size: 'over the size limit',
  network: 'could not be fetched',
}

async function handleImport() {
  if (!detectedLinks.value.length) {
    toast.add({
      title: 'No links',
      description: 'Paste at least one imgur link.',
      color: 'warning',
      duration: 2000,
    })
    return
  }

  const result = await importLinks(rawInput.value, {
    remaining: props.remaining,
    maxFileSizeMB: props.maxFileSizeMb,
    accept: props.accept,
    staged: props.staged,
  })

  if (result.items.length) emit('imported', result.items)

  // One toast summarising the batch, in the shape the bulk paths use. The
  // reasons are grouped rather than listed per link: a dead album pasted as
  // twenty links should read as one problem, not twenty.
  const parts: string[] = []
  if (result.items.length) parts.push(`Added ${result.items.length}`)
  if (result.duplicates > 0) parts.push(`${result.duplicates} already staged`)
  if (result.overflow > 0) parts.push(`${result.overflow} over the file limit`)
  const byReason = new Map<ImgurSkipReason, number>()
  for (const skip of result.skipped) byReason.set(skip.reason, (byReason.get(skip.reason) ?? 0) + 1)
  for (const [reason, count] of byReason) parts.push(`${count} ${SKIP_LABELS[reason]}`)

  const failed = result.skipped.length + result.overflow + result.duplicates
  toast.add({
    title: result.items.length ? 'Imgur links staged' : 'Nothing could be staged',
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
    title="Add from Imgur"
    :ui="{ content: 'sm:max-w-xl' }"
    @update:open="emit('update:isVisible', $event)"
  >
    <template #body>
      <p class="text-xs text-night-400 mb-3">
        Paste imgur links and they are fetched into the staging area as files — for recovering
        things whose source file is gone. Everything after that is a normal upload: idols, tags,
        destination and all.
      </p>

      <UTextarea
        v-model="rawInput"
        :rows="7"
        placeholder="Paste imgur links here — markdown, prose and one-per-line all work..."
        class="w-full"
        :ui="{ base: 'tools-textarea font-mono text-xs! resize-y' }"
      />

      <div class="flex items-center gap-2 mt-2 mb-4 text-sm font-mono text-night-500">
        <span>{{ detectedLinks.length }} detected</span>
        <span aria-hidden="true">·</span>
        <span>room for {{ remaining }}</span>
        <span v-if="isImporting" class="ml-auto text-pink-300">
          fetching {{ importedSoFar }}/{{ importTotal }}
        </span>
      </div>

      <!-- Albums can't be resolved without imgur's OpenGraph tags, which the
           browser is not allowed to read. Said up front rather than reported as
           a failure after a wasted fetch. -->
      <p class="text-sm text-night-600 mb-4">
        Album and gallery links won't work here — paste the direct image links instead.
        {{ typeLabel }} files only, up to {{ maxFileSizeMb }}MB each.
      </p>

      <div class="flex gap-3">
        <UButton label="Cancel" color="neutral" block @click="handleHide" />
        <UButton
          label="Fetch & Stage"
          color="success"
          block
          :loading="isImporting"
          :disabled="!detectedLinks.length || remaining < 1"
          @click="handleImport"
        />
      </div>
    </template>
  </UModal>
</template>
