<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ContentsItem, SetsItem, SetsUnifiedItem } from '~/types/appTypes'
import type { ShortLinkVariant } from '~/utils/shortLink'
import { computed, onMounted, shallowRef } from 'vue'

const props = defineProps<{
  content: ContentsItem
  /** The post's set record, when the card holds one; otherwise its id is used. */
  set?: SetsItem | SetsUnifiedItem | null
  /**
   * A visible wrench as well as right-click/long-press — for list rows, where
   * a dense row has no obvious surface to right-click.
   */
  withTrigger?: boolean
  /**
   * What the card's own heart likes. `set` (a grouped card's) puts "Like only
   * this post" here; `post`, the default, puts "Like whole set" — the menu
   * always offers the other one.
   */
  likeScope?: 'set' | 'post'
}>()

const emit = defineEmits<{
  openCollections: []
  openLabels: []
  openReport: []
  likeAllInSet: []
  likeOne: []
  /** From the manage actions: edited or moved, the listing should refetch. */
  changed: []
  contentDeleted: []
  setDeleted: []
}>()

const toast = useToast()
const pb = usePocketBase()
const { downloadAllIn } = useDownloadAll()
const { copyLinksFrom } = useCopyLinks()
const baseItems = shallowRef<DropdownMenuItem[][]>([])

// Edit / move / delete for owners and admins, from the shared ManageActions.
// Placed just above Report, which stays last.
// shallowRef: a deep ref's type unwrapping of DropdownMenuItem overflows tsc.
const manageRef = shallowRef<{ groups: DropdownMenuItem[][] } | null>(null)
const { isLiked } = useLikeItem(() => props.content)

/**
 * The like that the card's heart doesn't do. Computed rather than built on
 * mount with the rest: "Like" / "Unlike" has to follow the post's state while
 * the menu stays mounted.
 */
const likeEntry = computed<DropdownMenuItem | null>(() => {
  if (props.likeScope === 'set') {
    return {
      label: isLiked.value ? 'Unlike only this post' : 'Like only this post',
      icon: 'i-lucide-heart',
      onSelect: () => emit('likeOne'),
    }
  }
  // Liking a card only ever liked that one item, which people kept missing on
  // multi-item sets. Emitted rather than handled here so each card can supply
  // the cheapest source of items: CardUnified already holds the whole set with
  // `likes` expanded, while CardBaseContent has to fetch.
  if (!props.content.set?.trim()) return null
  return {
    label: 'Like whole set',
    icon: 'i-lucide-heart',
    onSelect: () => emit('likeAllInSet'),
  }
})

const items = computed<DropdownMenuItem[][]>(() => {
  const manage = manageRef.value?.groups ?? []
  // The like sits at the end of the first group (add to collection, add label).
  const [organise = [], ...rest] = baseItems.value
  const base = likeEntry.value ? [[...organise, likeEntry.value], ...rest] : baseItems.value
  if (!manage.length) return base
  return [...base.slice(0, -1), ...manage, ...base.slice(-1)]
})

// Programmatic context menu: parents call `show(event)` (right-click or
// long-press) and the menu opens anchored to a virtual element at the
// pointer position. Registered with the global single-open-menu registry.
const { open, reference, show } = useContextMenuAnchor()

defineExpose({ show, manage: manageRef })

async function copyPreview() {
  // Null when there is no preview object; what gets copied is the short link —
  // see utils/shortLink.ts for why the two differ.
  const link = shortLink(props.content, 'preview')
  if (!link) {
    toast.add({
      title: 'No link to copy',
      color: 'warning',
      duration: 2000,
    })
    return
  }
  await navigator.clipboard.writeText(link)
  toast.add({
    title: 'Link copied',
    color: 'info',
    duration: 1000,
  })
}

/** Shared by the HD and SD entries — `label` names the rendition in the toast. */
async function copyRendition(url: string, label: string) {
  try {
    await navigator.clipboard.writeText(url)
    toast.add({
      title: `${label} link copied`,
      color: 'info',
      duration: 1000,
    })
  } catch {
    toast.add({
      title: "Couldn't copy link",
      color: 'error',
      duration: 3000,
    })
  }
}

async function copyMirror() {
  await navigator.clipboard.writeText(props.content.mirror)
  toast.add({
    title: 'Imgur link copied',
    color: 'info',
    duration: 1000,
  })
}

function openDiscord() {
  openDiscordMessage(props.content.discord)
}

/** What "Copy → Whole set" can hand out, one link per post that has it. */
type SetLinkKind = 'mirror' | ShortLinkVariant

/**
 * Every post in the set, fetched on select like the whole-set download: the
 * menu opens without counting anything, and the toast says how many there were.
 */
function copySetLinks(setId: string, kind: SetLinkKind, label: string) {
  void copyLinksFrom(async () => {
    const posts = await pb.collection('contents').getFullList<ContentsItem>({
      filter: pb.filter('set={:id}', { id: setId }),
      fields: 'id,preview,original,sd,mirror',
      sort: 'created',
      requestKey: null,
    })
    return posts
      .map((post) => (kind === 'mirror' ? post.mirror?.trim() : shortLink(post, kind)))
      .filter((url): url is string => !!url)
  }, label)
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

/**
 * A submenu entry, plus what it becomes when it's the only one: a lone entry is
 * lifted to the top level rather than given a submenu of its own, and there it
 * needs its full name back ("SD mp4" → "Download SD mp4").
 */
type MenuEntry = DropdownMenuItem & { flat?: Partial<DropdownMenuItem> }

function submenu(label: string, icon: string, groups: MenuEntry[][]): DropdownMenuItem | null {
  const actions = groups.flat().filter((entry) => entry.type !== 'label')
  if (actions.length === 0) return null
  if (actions.length === 1) {
    const { flat, ...item } = actions[0]!
    return { ...item, ...flat }
  }
  return {
    label,
    icon,
    children: groups
      .filter((group) => group.some((entry) => entry.type !== 'label'))
      .map((group) => group.map(({ flat: _flat, ...item }) => item)),
  }
}

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
      label: 'Add to collection',
      icon: 'i-lucide-folder-plus',
      onSelect: () => emit('openCollections'),
    },
    {
      label: 'Add label',
      icon: 'i-lucide-tag',
      onSelect: () => emit('openLabels'),
    },
  ]

  // The like entry joins this group in `items`, where it can stay reactive.

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

  // Copy and Download each collapse into one submenu row. With the whole-set
  // download alongside the per-item ones the flat menu ran past fifteen rows;
  // separators alone stopped being enough. Inside a submenu the parent already
  // says the verb, so the entries name only the rendition.
  //
  // Four kinds, in the order people reach for them: the imgur mirror when the
  // post has one, the Discord-friendly preview, then the two video renditions.
  const copyItem: MenuEntry[] = []
  const copySet: MenuEntry[] = []
  const setId = c.set?.trim()

  // The whole set offers what this post does — sets are uploaded and encoded
  // together, so it's a fair guess for the rest, the same bet the whole-set
  // download makes with SD. Posts lacking a kind are skipped, and a set with
  // none at all says so.
  function offerForSet(kind: SetLinkKind, entry: MenuEntry, toastLabel: string, flatLabel: string) {
    if (!setId) return
    copySet.push({
      ...entry,
      onSelect: () => copySetLinks(setId, kind, toastLabel),
      flat: { label: flatLabel },
    })
  }

  // `mirror` holds imgur links and nothing else (see bot/links.go), so the entry
  // can name the destination instead of the vague "mirror".
  if (c.mirror?.trim()) {
    copyItem.push({
      label: 'Imgur',
      icon: 'i-simple-icons-imgur',
      onSelect: () => copyMirror(),
      flat: { label: 'Copy Imgur link' },
    })
    offerForSet(
      'mirror',
      { label: 'Imgur', icon: 'i-simple-icons-imgur' },
      'Imgur',
      'Copy set Imgur links',
    )
  }

  // A video's preview is its mp4, the same file as HD, so it gets no entry.
  if (filetype !== 'video') {
    copyItem.push({
      label: previewCopyLabel.value.replace(/^Copy /, ''),
      icon: 'i-simple-icons-discord',
      onSelect: () => copyPreview(),
      flat: { label: previewCopyLabel.value },
    })
    // Named like this post's entry, by format: the two groups list the same
    // kinds, and a set is uploaded together, so it's mostly one format.
    const previewLabel = previewCopyLabel.value.replace(/^Copy /, '')
    offerForSet(
      'preview',
      { label: previewLabel, icon: 'i-simple-icons-discord' },
      previewLabel,
      `Copy set ${previewLabel} links`,
    )
  }

  if (filetype === 'video' || filetype === 'gif') {
    if (hdLink) {
      copyItem.push({
        label: 'HD MP4',
        slot: 'hd',
        onSelect: () => copyRendition(hdLink, 'HD'),
        flat: { label: 'Copy HD MP4' },
      })
      offerForSet('hd', { label: 'HD MP4', slot: 'hd' }, 'HD', 'Copy set HD links')
    }

    if (sdLink) {
      copyItem.push({
        label: 'SD MP4',
        slot: 'sd',
        onSelect: () => copyRendition(sdLink, 'SD'),
        flat: { label: 'Copy SD MP4' },
      })
      offerForSet('sd', { label: 'SD MP4', slot: 'sd' }, 'SD', 'Copy set SD links')
    }
  }

  // Download, split by rendition for anything with two of them.
  //
  // A single "Download" handed over `original`, which is AV1 — and Safari never
  // software-decodes AV1, so on Apple devices below A17 Pro / M3 the file
  // downloads fine and then refuses to play. `sd` is the H.264 720p rendition
  // that exists for exactly those devices (see hooks/h264.go), and until now it
  // was only reachable by copying its link and fetching it by hand.
  const isMotion = filetype === 'video' || filetype === 'gif'
  const downloadItem: MenuEntry[] = []

  if (isMotion) {
    if (hdUrl) {
      downloadItem.push({
        label: 'HD MP4',
        slot: 'hd',
        onSelect: () => downloadFile(hdUrl),
        // Flattened, the leading icon goes back to the download glyph; the slot
        // only hangs the AV1 compatibility hint off the trailing edge.
        flat: { label: 'Download HD MP4', icon: 'i-lucide-download', slot: 'downloadHd' },
      })
    }
    // Conditional for the same reason the SD copy entry above is: the rendition
    // is best-effort backend-side and absent entirely on older records.
    if (sdUrl) {
      downloadItem.push({
        label: 'SD MP4',
        slot: 'sd',
        onSelect: () => downloadFile(sdUrl),
        flat: { label: 'Download SD MP4', icon: 'i-lucide-download', slot: undefined },
      })
    }
  } else if (hdUrl) {
    // Stills and stickers have one rendition, so naming it would be noise.
    downloadItem.push({
      label: 'This post',
      icon: 'i-lucide-image',
      onSelect: () => downloadFile(hdUrl),
      flat: { label: 'Download', icon: 'i-lucide-download' },
    })
  }

  // The whole set, from a card on a listing, without opening the set page.
  // Fetched on select rather than counted up front, so the menu stays free to
  // open. SD is offered when this item has one — sets are encoded together, so
  // it's a fair guess for the rest, and the summary toast names any that lack it.
  const downloadSet: MenuEntry[] = []

  if (setId) {
    if (isMotion) {
      downloadSet.push({
        label: 'HD MP4',
        slot: 'hd',
        onSelect: () => void downloadAllIn({ setId }, 'hd'),
        flat: { label: 'Download set as HD MP4', icon: 'i-lucide-download', slot: 'downloadHd' },
      })
      if (sdUrl) {
        downloadSet.push({
          label: 'SD MP4',
          slot: 'sd',
          onSelect: () => void downloadAllIn({ setId }, 'sd'),
          flat: { label: 'Download set as SD MP4', icon: 'i-lucide-download', slot: undefined },
        })
      }
    } else {
      downloadSet.push({
        label: 'Whole set',
        icon: 'i-lucide-images',
        onSelect: () => void downloadAllIn({ setId }, 'hd'),
        flat: { label: 'Download set', icon: 'i-lucide-download' },
      })
    }
  }

  // Headed only when the two scopes sit side by side as rendition lists — two
  // "HD mp4" rows need telling apart. A still's entries name their scope.
  const downloadGroups =
    isMotion && downloadItem.length && downloadSet.length
      ? [
          [{ type: 'label' as const, label: 'This post' }, ...downloadItem],
          [{ type: 'label' as const, label: 'Whole set' }, ...downloadSet],
        ]
      : [downloadItem, downloadSet]

  // Always headed when both scopes are there: "HD MP4" for this post and for
  // the set would otherwise be two identical rows.
  const copyGroups =
    copyItem.length && copySet.length
      ? [
          [{ type: 'label' as const, label: 'This post' }, ...copyItem],
          [{ type: 'label' as const, label: 'Whole set' }, ...copySet],
        ]
      : [copyItem, copySet]

  const transfer = [
    submenu('Copy', 'i-lucide-copy', copyGroups),
    submenu('Download', 'i-lucide-download', downloadGroups),
  ].filter((item): item is DropdownMenuItem => !!item)

  const retrieve: DropdownMenuItem[] = []

  if (c.source?.trim()) {
    retrieve.push({
      label: 'Go to source',
      icon: 'i-lucide-link',
      onSelect: () => window.open(c.source, '_blank'),
    })
  }

  if (c.discord?.trim()) {
    retrieve.push({
      label: 'Open in Discord',
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
  baseItems.value = [organise, transfer, retrieve, flag].filter((group) => group.length > 0)
})
</script>

<template>
  <UDropdownMenu
    v-model:open="open"
    :items="items"
    :modal="false"
    :content="
      withTrigger
        ? { side: 'bottom', align: 'end', sideOffset: 4 }
        : { reference, side: 'bottom', align: 'start', sideOffset: 2 }
    "
  >
    <!-- Default slot only when asked for: an empty one is what keeps the
         right-click mode anchored to the pointer. -->
    <UButton
      v-if="withTrigger"
      icon="i-lucide-ellipsis"
      color="neutral"
      variant="ghost"
      size="xs"
      square
      aria-label="Post actions"
    />
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

  <ManageActions
    ref="manageRef"
    :content="content"
    :set="set"
    @changed="emit('changed')"
    @content-deleted="emit('contentDeleted')"
    @set-deleted="emit('setDeleted')"
  />
</template>
