<script setup lang="ts">
import { computed } from 'vue'

/**
 * The "Imgur Links" card shared by /tools and /tools/[id]: textarea,
 * pasted-count, and the Format / Generate / Download actions. Both pages
 * carried a byte-identical copy of all of it; the only thing that differs —
 * the trailing primary button (Share vs Update) — comes in through the slot.
 *
 * Takes the page's useImgurTools instance rather than creating its own: the
 * page still owns `items` for the preview grid, and the two must share state.
 */
const props = defineProps<{
  tools: ReturnType<typeof useImgurTools>
}>()

const toast = useToast()
const router = useRouter()
const { requireAuth } = useAuthGate()

const { inputLinks, normalizeLinks, generateItems, downloadAll, linkLines } = props.tools

const pastedCount = computed(() => inputLinks.value.split('\n').filter((l) => l.trim()).length)

/**
 * Hand the pasted links to /uploads and let it do the ingesting.
 *
 * Deliberately a handoff rather than an upload button here: a `contents` record
 * needs an idol and a group, and this page has no metadata UI at all — building
 * one would be re-creating the upload page beside it. So the links travel and
 * the upload page, which already owns idols, tags, dates, set-vs-collection and
 * set matching, does the rest.
 */
function onSendToUpload() {
  normalizeLinks()
  const links = linkLines()
  if (links.length === 0) {
    toast.add({
      title: 'No links',
      description: 'Paste at least one valid imgur link.',
      color: 'warning',
      duration: 2000,
    })
    return
  }
  // Gated here as well as on the upload page: bouncing someone to /uploads only
  // for the auth middleware to redirect them to /login loses the links.
  if (!requireAuth('upload content')) return

  localStorage.setItem(IMGUR_HANDOFF_KEY, links.join('\n'))
  router.push('/uploads')
}

async function onDownloadAll() {
  // Both pages funnel through here now — /tools used to fail silently on an
  // empty textarea while /tools/[id] toasted; the toast wins.
  const count = await downloadAll()
  if (count === 0) {
    toast.add({
      title: 'No links',
      description: 'No valid imgur links found.',
      color: 'warning',
      duration: 2000,
    })
  }
}
</script>

<template>
  <div class="glass-card p-5 mb-6">
    <div class="flex items-center gap-2 mb-3">
      <UIcon name="i-lucide-link" class="text-pink-300" />
      <h2 class="micro-label text-pink-300">Imgur Links</h2>
      <span class="ml-auto text-sm text-night-500 font-mono"> {{ pastedCount }} pasted </span>
    </div>

    <UTextarea
      v-model="inputLinks"
      :rows="6"
      placeholder="Paste imgur links here, one per line..."
      class="w-full"
      :ui="{ base: 'tools-textarea font-mono text-xs! resize-y' }"
    />

    <div class="flex flex-wrap gap-2 mt-3">
      <UButton
        label="Format"
        icon="i-lucide-palette"
        color="neutral"
        variant="outline"
        size="sm"
        @click="normalizeLinks"
      />
      <UButton
        label="Generate Grid"
        icon="i-lucide-layout-grid"
        color="neutral"
        variant="outline"
        size="sm"
        @click="generateItems"
      />
      <UButton
        label="Download All"
        icon="i-lucide-download"
        color="neutral"
        variant="outline"
        size="sm"
        @click="onDownloadAll"
      />
      <UButton
        label="Send to Upload"
        icon="i-lucide-cloud-upload"
        color="neutral"
        variant="outline"
        size="sm"
        @click="onSendToUpload"
      />
      <!-- The page's primary action: Share on /tools, Update-or-Share on [id]. -->
      <slot />
    </div>
  </div>
</template>
