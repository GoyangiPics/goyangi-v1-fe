<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ContentsItem } from '~/types/appTypes'
import { computed, onMounted, ref } from 'vue'

const props = defineProps<{
  content: ContentsItem
}>()

const emit = defineEmits<{
  openCollections: []
  openLabels: []
  openReport: []
  likeAllInSet: []
}>()

const toast = useToast()
const items = ref<DropdownMenuItem[][]>([])

// Programmatic context menu: parents call `show(event)` (right-click or
// long-press) and the menu opens anchored to a virtual element at the
// pointer position. Registered with the global single-open-menu registry.
const { open, reference, show } = useContextMenuAnchor()

defineExpose({ show })

async function copyPreview() {
  // Null when there is no preview object; what gets copied is the short link —
  // see utils/shortLink.ts for why the two differ.
  const link = shortLink(props.content, 'preview')
  if (!link) {
    toast.add({
      title: 'Nothing to copy',
      description: 'This item has no preview link.',
      color: 'warning',
      duration: 2000,
    })
    return
  }
  await navigator.clipboard.writeText(link)
  toast.add({
    title: 'Copied!',
    description: 'Preview link copied to clipboard.',
    color: 'info',
    duration: 1000,
  })
}

/** Shared by the HD and SD entries — `label` names the rendition in the toast. */
async function copyRendition(url: string, label: string) {
  try {
    await navigator.clipboard.writeText(url)
    toast.add({
      title: 'Copied!',
      description: `${label} link copied to clipboard.`,
      color: 'info',
      duration: 1000,
    })
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to copy the link.',
      color: 'error',
      duration: 3000,
    })
  }
}

async function copyMirror() {
  await navigator.clipboard.writeText(props.content.mirror)
  toast.add({
    title: 'Copied!',
    description: 'Mirror link copied to clipboard.',
    color: 'info',
    duration: 1000,
  })
}

function openDiscord() {
  openDiscordMessage(props.content.discord)
}

/**
 * The preview object is AVIF or WebP depending on the record — stills are always
 * AVIF, gifs follow `preview_format` — so this entry can't carry a fixed name.
 *
 * Read off the URL rather than the `preview_format` field: the URL is what gets
 * pasted, and it's the only thing guaranteed to match the object that exists.
 */
const previewCopyLabel = computed(() =>
  /\.webp(?:[?#]|$)/i.test(props.content.preview ?? '') ? 'Copy WebP' : 'Copy AVIF',
)

onMounted(() => {
  const filetype = props.content.filetype
  const c = props.content

  // Grouped rather than one flat list: eleven entries in a right-click menu is a
  // wall of text, and these fall into distinct intents. Separators only, no
  // group headers — headers would add four more rows to a menu whose problem is
  // height, and separator-only grouping is the convention for context menus.
  const organise: DropdownMenuItem[] = [
    {
      // No separate "Add All" entry beside this one: the modal it opens carries
      // an "add all contents from set" checkbox, which is both fewer rows here
      // and the only place the choice is actually visible before it happens.
      label: 'Add To Collection',
      icon: 'i-lucide-folder-plus',
      onSelect: () => emit('openCollections'),
    },
    {
      label: 'Add Label',
      icon: 'i-lucide-tag',
      onSelect: () => emit('openLabels'),
    },
  ]

  // Liking a card only ever liked that one item, which people kept missing on
  // multi-item sets. Emitted rather than handled here so each card can supply
  // the cheapest source of items: CardUnified already holds the whole set with
  // `likes` expanded, while CardBaseContent has to fetch.
  if (c.set?.trim()) {
    organise.push({
      label: 'Like All',
      icon: 'i-lucide-heart',
      onSelect: () => emit('likeAllInSet'),
    })
  }

  // The two video renditions, resolved once for both the copy and download
  // entries below. HD is the AV1 1080p original, SD the H.264 720p fallback;
  // `sd` is best-effort backend-side and absent on records predating it, so
  // every entry that offers one is gated on the link existing.
  //
  // Download hands over the CDN URL; copy hands over the short link to it. The
  // CDN key wraps in a Discord message, and the string is only ever read when
  // pasted. The short links are null exactly when the CDN URL is empty.
  const hdUrl = c.original
  const sdUrl = c.sd
  const hdLink = shortLink(c, 'hd')
  const sdLink = shortLink(c, 'sd')

  const copy: DropdownMenuItem[] = []

  if (filetype !== 'video') {
    copy.push({
      label: previewCopyLabel.value,
      icon: 'i-simple-icons-discord',
      onSelect: () => copyPreview(),
    })
  }

  if (filetype === 'video' || filetype === 'gif') {
    if (hdLink) {
      copy.push({
        label: 'Copy HD mp4',
        slot: 'hd',
        onSelect: () => copyRendition(hdLink, 'HD'),
      })
    }

    if (sdLink) {
      copy.push({
        label: 'Copy SD mp4',
        slot: 'sd',
        onSelect: () => copyRendition(sdLink, 'SD'),
      })
    }
  }

  // `mirror` holds imgur links and nothing else (see bot/links.go), so the entry
  // can name the destination instead of the vague "mirror".
  if (c.mirror?.trim()) {
    copy.push({
      label: 'Copy Imgur',
      icon: 'i-lucide-copy',
      onSelect: () => copyMirror(),
    })
  }

  // Download, split by rendition for anything with two of them.
  //
  // A single "Download" handed over `original`, which is AV1 — and Safari never
  // software-decodes AV1, so on Apple devices below A17 Pro / M3 the file
  // downloads fine and then refuses to play. `sd` is the H.264 720p rendition
  // that exists for exactly those devices (see hooks/h264.go), and until now it
  // was only reachable by copying its link and fetching it by hand.
  const retrieve: DropdownMenuItem[] = []

  if (filetype === 'video' || filetype === 'gif') {
    if (hdUrl) {
      retrieve.push({
        label: 'Download HD mp4',
        icon: 'i-lucide-download',
        // Leading stays the download icon (no -leading override below); the slot
        // is only here to hang the AV1 compatibility hint off the trailing edge.
        slot: 'downloadHd',
        onSelect: () => downloadFile(hdUrl),
      })
    }
    // Conditional for the same reason the SD copy entry above is: the rendition
    // is best-effort backend-side and absent entirely on older records.
    if (sdUrl) {
      retrieve.push({
        label: 'Download SD mp4',
        icon: 'i-lucide-download',
        onSelect: () => downloadFile(sdUrl),
      })
    }
  } else if (hdUrl) {
    // Stills and stickers have one rendition, so naming it would be noise.
    retrieve.push({
      label: 'Download',
      icon: 'i-lucide-download',
      onSelect: () => downloadFile(hdUrl),
    })
  }

  if (c.source?.trim()) {
    retrieve.push({
      label: 'Go To Source',
      icon: 'i-lucide-link',
      onSelect: () => window.open(c.source, '_blank'),
    })
  }

  if (c.discord?.trim()) {
    retrieve.push({
      label: 'Go To Discord Message',
      icon: 'i-simple-icons-discord',
      onSelect: () => openDiscord(),
    })
  }

  const flag: DropdownMenuItem[] = [
    {
      label: 'Report',
      icon: 'i-lucide-flag',
      onSelect: () => emit('openReport'),
    },
  ]

  // Drop empties so a record missing a whole category leaves no stray separator.
  items.value = [organise, copy, retrieve, flag].filter((group) => group.length > 0)
})
</script>

<template>
  <UDropdownMenu
    v-model:open="open"
    :items="items"
    :modal="false"
    :content="{ reference, side: 'bottom', align: 'start', sideOffset: 2 }"
  >
    <!-- Text glyphs ("HD" / "SD") from app/assets/cards.css, in the style of
         the "MP4" one this menu used before the renditions were split. -->
    <template #hd-leading>
      <span class="badge-hd-icon" />
    </template>
    <template #sd-leading>
      <span class="badge-sd-icon" />
    </template>

    <!-- Both AV1 entries carry the compatibility hint. A native `title` rather
         than a UTooltip: this renders inside the menu's own portal, where a
         second portal's hover handling would be fighting the menu's item
         highlight and keyboard navigation. `title` cannot break, and it is the
         idiom the upload page already uses for its rendition badges. -->
    <template #hd-trailing>
      <span :title="AV1_COMPAT_HINT" class="flex items-center shrink-0">
        <UIcon name="i-lucide-info" class="text-night-500 text-xs" />
      </span>
    </template>
    <template #downloadHd-trailing>
      <span :title="AV1_COMPAT_HINT" class="flex items-center shrink-0">
        <UIcon name="i-lucide-info" class="text-night-500 text-xs" />
      </span>
    </template>
  </UDropdownMenu>
</template>
