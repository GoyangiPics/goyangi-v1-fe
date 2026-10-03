<script setup lang="ts">
import { CalendarDate } from '@internationalized/date'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

useHead({ title: 'Upload' })

definePageMeta({
  middleware: ['auth'],
})

const pb = usePocketBase()
const toast = useToast()
const authStore = useAuthStore()

const referenceStore = useReferenceStore()

const title = ref('')
const selectedIdols = ref<any[]>([])
const selectedTags = ref<any[]>([])
const selectedDate = ref<Date | null>(null)
const source = ref('')

// UInputDate works with CalendarDate, the rest of the page with JS Date —
// bridge at the component boundary.
const toCal = (d: Date | null) =>
  d ? new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate()) : undefined
const fromCal = (c?: { year: number; month: number; day: number } | null) =>
  c ? new Date(c.year, c.month - 1, c.day) : null
const selectedDateModel = computed({
  get: () => toCal(selectedDate.value),
  set: (v) => {
    selectedDate.value = fromCal(v)
  },
})

/**
 * The animated preview format for gif uploads (the `preview_format` field).
 *
 * Fixed at WebP rather than offered as a choice. It decodes on effectively every
 * device, where AVIF is still spotty on older clients, and the size difference
 * never justified making every uploader answer a codec question — the bot has
 * hardcoded the same value all along (bot/records.go). The backend still
 * defaults to AVIF when the field is absent, so it is sent explicitly.
 *
 * Frame interpolation used to sit beside it and is gone entirely: the control
 * shipped disabled because the RIFE pipeline is not finished, so it was a
 * permanently greyed-out select explaining an option nobody could pick.
 */
const GIF_PREVIEW_FORMAT = 'webp'

// The grouped idol picker (grouping, search, header toggling, collapsed chips)
// now lives in IdolSelectMenu — this page had a hand-rolled copy of all of it.
const inferredGroups = computed(() => inferGroups(selectedIdols.value, referenceStore.groups))

const canUpload = computed(() => !!authStore.user?.canUpload)

// Contact routes for the "request upload access" banner.
const { discordInvite, supportEmail } = useRuntimeConfig().public

// The tab type lives in uploadPlan.ts as UploadTab; `UploadType` is kept as
// the local name the rest of this file already uses.
type UploadType = UploadTab

const uploadTypeConfig: Record<
  UploadType,
  {
    label: string
    icon: string
    accept: string
    hint: string
    description: string
    maxFiles: number
    maxFileSizeMB: number
    maxTotalSizeMB: number
  }
> = {
  // Pics and gifs share a tab on purpose. The container decides which pipeline
  // a file gets — see hintFiletype and the server's reclassifyContentType —
  // so the choice a separate tab used to force was one the file could make
  // better itself, and getting it wrong (a .webm dropped on "Pics") produced a
  // one-frame AVIF. Both kinds can be mixed in one batch.
  //
  // No .gif: it is the one legacy container, and every gif on the internet is
  // served as mp4 anyway. Convert first.
  //
  // Limits are the former gif tab's, inherited by pics: uploads are sequential
  // and the backend queue holds only a record id per job, so the count costs
  // nothing on either side.
  media: {
    label: 'Pics & GIFs',
    icon: 'i-lucide-images',
    accept:
      'image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/x-matroska,video/quicktime,.jpg,.jpeg,.png,.webp,.avif,.mp4,.webm,.mkv,.mov',
    hint: '.jpg .png .webp .avif .mp4 .webm .mkv .mov',
    description: 'Pics → AVIF · animated → AV1 with a WebP/AVIF preview · the file decides which',
    maxFiles: 50,
    // 100 MB, not the pipeline's own ceiling: Cloudflare rejects a larger body
    // before it ever reaches PocketBase, so anything above this fails at the
    // proxy with an error the app can't explain.
    maxFileSizeMB: 100,
    maxTotalSizeMB: 1024,
  },
  video: {
    label: 'Video',
    icon: 'i-lucide-video',
    accept: 'video/mp4,video/webm,video/x-matroska,video/quicktime,.mp4,.webm,.mkv,.mov',
    hint: '.mp4 .webm .mkv .mov',
    description: 'Transcoded to AV1 · audio preserved · no autoplay',
    maxFiles: 1,
    // See the gif note: capped by Cloudflare, not by the encoder.
    maxFileSizeMB: 100,
    maxTotalSizeMB: 100,
  },
  sticker: {
    label: 'Sticker',
    icon: 'i-lucide-star',
    accept:
      'image/avif,image/webp,image/jpeg,image/png,video/mp4,video/webm,video/x-matroska,video/quicktime,.avif,.webp,.jpg,.jpeg,.png,.mp4,.webm,.mkv,.mov',
    hint: '.avif .webp .jpg .png .mp4 .webm .mkv .mov',
    description: 'Square cropped to 200×200 · AVIF · audio stripped',
    maxFiles: 1,
    maxFileSizeMB: 10,
    maxTotalSizeMB: 10,
  },
}

interface UploadResult {
  fileName: string
  fileSize: number
  recordId: string
  /**
   * `slow` means uploaded and still encoding after we stopped watching — a
   * success we lost sight of, distinct from `error`, which is a real failure.
   */
  status: 'uploading' | 'processing' | 'done' | 'error' | 'slow'
  /** Animated AVIF/WebP preview — the Discord-embeddable link. */
  avifUrl?: string
  /** AV1 1080p MP4 — the canonical rendition. */
  originalUrl?: string
  /** H.264 720p MP4 — the compatibility rendition. */
  sdUrl?: string
  filetype?: Filetype
  error?: string
  /** Drives the per-row checkbox that scopes the copy-all buttons. */
  selected: boolean
}

const selectedUploadType = ref<UploadType>('media')

// Files selected in the dropzone — the single source of truth the upload
// logic drives from (replaces the old FileUpload internal file list).
const selectedFiles = ref<File[]>([])

// UFileUpload's model is File[] when `multiple`, File | null otherwise.
// Bridge both shapes onto the File[] above.
const isMultipleUpload = computed(() => uploadTypeConfig[selectedUploadType.value].maxFiles > 1)
const fileUploadModel = computed<any>({
  get: () => (isMultipleUpload.value ? selectedFiles.value : (selectedFiles.value[0] ?? null)),
  set: (v: File[] | File | null) => {
    // The old FileUpload skipped re-picked duplicates and rejected oversized
    // files at selection time; UFileUpload appends everything silently.
    //
    // `v` is the accumulated list, for drops as well as picks: Nuxt UI's
    // useFileUpload calls onUpdate(files) with reset defaulting to false on both
    // paths (its onDrop's second argument is `fromDropZone`, which only syncs the
    // native input element — not a reset flag).
    const cfg = uploadTypeConfig[selectedUploadType.value]
    const seen = new Set<string>()
    const accepted: File[] = []
    for (const f of Array.isArray(v) ? v : v ? [v] : []) {
      const key = fileKey(f)
      if (seen.has(key)) continue
      seen.add(key)
      // UFileUpload's `accept` only filters the OS picker dialog; a drag-and-drop
      // bypasses it entirely. This is where a .webm dropped on the wrong tab —
      // or a .gif dropped anywhere — used to slip through.
      if (!isAcceptedByFilter(f.type, f.name, cfg.accept)) {
        const isGif = /\.gif$/i.test(f.name)
        toast.add({
          title: isGif ? "GIFs aren't accepted" : 'Unsupported file',
          description: isGif
            ? `"${f.name}" — convert it to mp4 or webm first; every gif host serves one.`
            : `"${f.name}" isn't a ${cfg.label} file (${cfg.hint}).`,
          color: 'warning',
          duration: 5000,
        })
        continue
      }
      if (f.size > cfg.maxFileSizeMB * 1024 * 1024) {
        toast.add({
          title: 'File too large',
          description: `"${f.name}" exceeds the ${cfg.maxFileSizeMB}MB per-file limit.`,
          color: 'warning',
          duration: 4000,
        })
        continue
      }
      accepted.push(f)
    }

    // maxFiles used to be checked only by validate() and customUploader(), i.e.
    // at submit time. Now that the drop target stays live and advertises itself,
    // staging 40 gifs and finding out on Upload is a much easier mistake to
    // make, so clamp here and say so.
    if (accepted.length > cfg.maxFiles) {
      const dropped = accepted.length - cfg.maxFiles
      toast.add({
        title: `Only ${cfg.maxFiles} file${cfg.maxFiles === 1 ? '' : 's'} allowed`,
        description: `Kept the first ${cfg.maxFiles}, ignored ${dropped} more.`,
        color: 'warning',
        duration: 4000,
      })
      accepted.length = cfg.maxFiles
    }

    selectedFiles.value = accepted
  },
})

// Switching type remounts UFileUpload (it is :key'd on the type) but
// selectedFiles lives on the page, so gif(5 files) -> video(maxFiles 1) would
// otherwise strand 5 files against a limit of 1.
watch(selectedUploadType, (type) => {
  const cfg = uploadTypeConfig[type]
  if (selectedFiles.value.length <= cfg.maxFiles) return
  const dropped = selectedFiles.value.length - cfg.maxFiles
  selectedFiles.value = selectedFiles.value.slice(0, cfg.maxFiles)
  toast.add({
    title: 'Selection trimmed',
    description: `${type} accepts ${cfg.maxFiles} file${cfg.maxFiles === 1 ? '' : 's'} — removed ${dropped}.`,
    color: 'warning',
    duration: 4000,
  })
})

const uploadResults = ref<UploadResult[]>([])
const createdSetId = ref<string | null>(null)
const createdSetTitle = ref<string | null>(null)

// True from the moment an upload run is committed to until its batch has fully
// landed. Files stay staged (and the Upload button stays enabled) for the whole
// run, so without this a second click mid-batch started a second concurrent
// doUpload — two sets created, the results list reset under the first batch.
const isUploading = ref(false)

const isCreateUploaderVisible = ref(false)
const isSetMergeDialogVisible = ref(false)
const matchingSets = ref<any[]>([])
const pendingFiles = ref<File[]>([])

// ─── Destination: a set, or an existing collection ───────────────────────────
// A set is an album of related content (same performance, same day). A
// collection is a loose user-made grouping, so its items are typically
// unrelated — which is why collection mode is also where per-file metadata
// matters.
type UploadMode = 'set' | 'collection'

// Deliberately NOT persisted. Restoring collection mode on a fresh visit would
// block Upload behind a "pick a collection" error the user never asked for.
const uploadMode = ref<UploadMode>('set')

/**
 * Whether this upload creates a set.
 *
 * Stickers never did, so they are excluded here as well as by mode. Every OTHER
 * `selectedUploadType !== 'sticker'` check in this file is about the sticker
 * *pipeline* (no tags, no date, fixed encoder settings) and must keep testing
 * the type directly — swapping one of those for this flag would either write
 * tags onto stickers or stop creating sets for gifs.
 */
const createsSet = computed(
  () => uploadMode.value === 'set' && selectedUploadType.value !== 'sticker',
)

/** Collection mode is a non-sticker destination; a sticker is one file, no album. */
const canChooseDestination = computed(() => selectedUploadType.value !== 'sticker')

const {
  collections: myCollections,
  isLoading: isLoadingCollections,
  fetchCollections: loadMyCollections,
  addLocal: addLocalCollection,
} = useMyCollections()

const selectedCollections = ref<any[]>([])
const isCreateCollectionVisible = ref(false)

const collectionIds = computed(() => selectedCollections.value.map((c: any) => c.id))

// Switching back to a set destination drops the collection choice, so a stale
// selection can't leak into a set upload's FormData.
watch(uploadMode, (mode) => {
  if (mode === 'set') selectedCollections.value = []
})

// Stickers have no destination choice, so force the mode back rather than
// leaving a hidden toggle in the collection position.
watch(selectedUploadType, (type) => {
  if (type === 'sticker') uploadMode.value = 'set'
})

/**
 * Where the batch landed, for the results banner.
 *
 * Populated only after an upload runs: `createdSetId` is set by doUpload, and
 * `uploadedCollections` is snapshotted then too, so clearing the picker
 * afterwards doesn't retitle a banner about work already done.
 */
const uploadedCollections = ref<any[]>([])

const destinationLinks = computed(() => {
  const links: Array<{ to: string; label: string; title: string; icon: string }> = []
  if (createdSetId.value) {
    links.push({
      to: `/set/${createdSetId.value}`,
      label: 'Uploaded to set',
      title: createdSetTitle.value ?? 'Set',
      icon: 'i-lucide-folder-open',
    })
  }
  for (const collection of uploadedCollections.value) {
    links.push({
      to: `/collection/${collection.id}`,
      label: 'Added to collection',
      title: collection.title || 'Collection',
      icon: 'i-lucide-images',
    })
  }
  return links
})

// Named rather than inline: UButton's click emit is typed void, so an inline
// assignment fails typecheck.
function openCreateCollection() {
  isCreateCollectionVisible.value = true
}

function onCollectionCreated(collection: any) {
  addLocalCollection(collection)
  selectedCollections.value = [...selectedCollections.value, collection]
}

// ─── Per-file metadata ───────────────────────────────────────────────────────
// Collection mode exists for unrelated files, so one shared idol list per batch
// doesn't fit. Overrides are keyed by fileKey rather than index, so reordering or
// removing a file can't shift someone's edits onto a different file.
//
// Absent key = inherit the batch value. Present = honoured literally, including
// an empty array, which validation then flags — see resolveFileMeta.
const overrides = ref<Record<string, FileOverride>>({})

// ─── Imgur-imported files ────────────────────────────────────────────────────
// Which staged files came from a link, and which links. Keyed by fileKey for the
// same reason overrides are: a File carries no room for provenance, and an index
// would shift under a removal.
//
// Two URLs per file, because they answer different questions. `requested` is
// the pasted-and-normalized form — the identity a re-import dedupes on, since a
// re-pasted link normalizes back to exactly it. `served` is the one that
// actually answered — a still fetched through the .jpg fallback must not store
// its guessed .mp4 form as `mirror`, which redirects to imgur's homepage.
interface ImgurSource {
  requested: string
  served: string
}
const imgurSources = ref<Record<string, ImgurSource>>({})
const isImgurImportVisible = ref(false)
/** Links handed over by the Imgur Tools page — see the handoff in onMounted. */
const imgurHandoffLinks = ref('')

/** Room left in the staging area, which is what the import dialog can fill. */
const remainingFileSlots = computed(
  () => uploadTypeConfig[selectedUploadType.value].maxFiles - selectedFiles.value.length,
)

function openImgurImport() {
  isImgurImportVisible.value = true
}

/**
 * Stage what the dialog fetched.
 *
 * Appended rather than replacing, so a link batch can be mixed with picked
 * files. The dialog already capped itself at remainingFileSlots, so there is no
 * second trim here — and going through the same dedupe the picker uses would
 * throw away a legitimately re-fetched file.
 */
function onImgurImported(items: ImgurImportItem[]) {
  const sources = { ...imgurSources.value }
  for (const item of items)
    sources[fileKey(item.file)] = { requested: item.url, served: item.servedUrl }
  imgurSources.value = sources
  selectedFiles.value = [...selectedFiles.value, ...items.map((item) => item.file)]
}

/** Grid is the default; Details is the editable one-row-per-file view. */
const stagedView = ref<'grid' | 'details'>('grid')

const resolvedFiles = computed<ResolvedFile[]>(() =>
  selectedFiles.value.map((file) => ({
    key: fileKey(file),
    name: file.name,
    ...resolveFileMeta(
      batchDefaults(),
      overrides.value[fileKey(file)],
      referenceStore.groups,
      file.name,
    ),
  })),
)

/** Which rows have their own metadata, for the "edited" marker and reset. */
function isEdited(key: string): boolean {
  return !!overrides.value[key]
}

function setOverride<K extends keyof FileOverride>(key: string, field: K, value: FileOverride[K]) {
  overrides.value[key] = { ...overrides.value[key], [field]: value }
}

function resetOverride(key: string) {
  const next = { ...overrides.value }
  delete next[key]
  overrides.value = next
}

// One prune, covering every removal path: the per-tile remove button, Clear, the
// type-switch trim, and the post-upload reset. Doing it at each call site would
// eventually miss one, and a stale override would then attach to a later file
// that happened to hash the same.
watch(selectedFiles, (files) => {
  const live = new Set(files.map((f) => fileKey(f)))
  const next: Record<string, FileOverride> = {}
  for (const [key, value] of Object.entries(overrides.value)) {
    if (live.has(key)) next[key] = value
  }
  overrides.value = next

  // Same prune, same reason: a stale imgur source would otherwise attach itself
  // to a later file that happened to hash the same, and mislabel its origin.
  const nextSources: Record<string, ImgurSource> = {}
  for (const [key, value] of Object.entries(imgurSources.value)) {
    if (live.has(key)) nextSources[key] = value
  }
  imgurSources.value = nextSources
})

// ─── Validation ──────────────────────────────────────────────────────────────
// The rules themselves live in ~/utils/uploadPlan (pure, unit-tested); this is
// just the reactive shell around them.
const errors = ref<ValidationErrors>({})
const fileErrors = ref<Record<string, string[]>>({})
const hasAttemptedUpload = ref(false)

function currentValidationInput(files: File[]): ValidationInput {
  const cfg = uploadTypeConfig[selectedUploadType.value]
  return {
    files,
    limits: cfg,
    batchIdols: selectedIdols.value,
    isSticker: selectedUploadType.value === 'sticker',
    title: title.value,
    source: source.value,
    requiresCollection: uploadMode.value === 'collection' && canChooseDestination.value,
    collectionIds: collectionIds.value,
    resolvedFiles: resolvedFiles.value,
  }
}

function validate(files: File[]): boolean {
  errors.value = computeUploadErrors(currentValidationInput(files))
  fileErrors.value = computeFileErrors(resolvedFiles.value)
  return Object.keys(errors.value).length === 0
}

// Re-run the whole check as the user edits, rather than deleting individual
// keys: the previous hand-rolled version cleared only idol/title/source, so
// every error key added since has gone stale on screen until the next submit.
watch(
  [
    selectedIdols,
    selectedDate,
    source,
    title,
    selectedUploadType,
    selectedFiles,
    uploadMode,
    selectedCollections,
    overrides,
  ],
  () => {
    if (!hasAttemptedUpload.value) return
    errors.value = computeUploadErrors(currentValidationInput(selectedFiles.value))
    fileErrors.value = computeFileErrors(resolvedFiles.value)
  },
  { deep: true },
)

const errorCountSummary = computed(() => Object.keys(errors.value).length)

// formatYYMMDD and toLocalDateString now live in ~/utils/uploadPlan, next to
// the code that consumes them, and are auto-imported.

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Returns a stable object URL for a File, cached by fileKey. */
const objectUrlCache = new Map<string, string>()
function getObjectUrl(file: File): string {
  const key = fileKey(file)
  let url = objectUrlCache.get(key)
  if (!url) {
    url = URL.createObjectURL(file)
    objectUrlCache.set(key, url)
  }
  return url
}
function revokeObjectUrl(file: File): void {
  const key = fileKey(file)
  const url = objectUrlCache.get(key)
  if (url) {
    URL.revokeObjectURL(url)
    objectUrlCache.delete(key)
  }
}

/** Release the preview object URL, then remove the file from the picker. */
function removeSelectedFile(file: File, index: number) {
  revokeObjectUrl(file)
  selectedFiles.value = selectedFiles.value.filter((_, i) => i !== index)
}

// "Yujin, Wonyoung - IVE" — the shared stem of both generated titles.
const idolsFromGroups = computed(() => buildContentTitle(selectedIdols.value, inferredGroups.value))

// Placeholder text only. The value actually saved comes from resolveTitle,
// which has a real fallback chain ending at the filename — this string must
// never reach a record.
const autoGeneratedTitle = computed(() => idolsFromGroups.value || 'Title...')

/** The batch-level metadata each file starts from, before any override. */
function batchDefaults(): BatchDefaults {
  return {
    idol: selectedIdols.value,
    tag: selectedTags.value,
    title: title.value,
    date: selectedDate.value,
  }
}

/** Everything about the upload that isn't per-file metadata. */
function uploadContext(setId: string | null, filetype: Filetype): UploadContext {
  const isSticker = filetype === 'sticker'
  return {
    filetype,
    isSticker,
    source: source.value,
    uploaderId: authStore.uploader?.id,
    // Gif-only: the backend keeps its fixed pipeline for every other filetype,
    // and defaults preview_format to AVIF when absent.
    // Sent for stills too: an animated WebP hinted `image` is reclassified to
    // `gif` on the server, and should honour the format choice when it is.
    previewFormat: filetype === 'gif' || filetype === 'image' ? GIF_PREVIEW_FORMAT : undefined,
    setId,
    // Independent of mode, so there is one branch rather than two: the picker is
    // only reachable in collection mode, and switching back to a set clears it.
    collectionIds: collectionIds.value,
  }
}

const autoGeneratedSetTitle = computed(() => {
  const prefix = formatYYMMDD(selectedDate.value ?? new Date())
  return idolsFromGroups.value ? `${prefix} ${idolsFromGroups.value}` : prefix
})

const doneCount = computed(() => uploadResults.value.filter((r) => r.status === 'done').length)
const processingCount = computed(
  () =>
    uploadResults.value.filter(
      (r) => r.status === 'processing' || r.status === 'uploading' || r.status === 'slow',
    ).length,
)
const errorCount = computed(() => uploadResults.value.filter((r) => r.status === 'error').length)

// The backend encodes one file at a time, so a batch dropped behind someone
// else's sits untouched until theirs clears. processingCount is this page's own
// share of that queue, which UploadQueueStatus subtracts so the uploader isn't
// told they're waiting behind themselves.
const {
  snapshot: queueSnapshot,
  refresh: refreshQueue,
  start: startQueuePolling,
} = useUploadQueue()

// Feed the copy-all buttons only, and only from rows the user left checked.
// Reversed on purpose: the results list grows downwards as uploads land, but
// the copied block is pasted oldest-last, so the order has to be flipped
// relative to what's on screen.
const selectedResults = computed(() => uploadResults.value.filter((r) => r.selected))

//
// Copied as the short link (utils/shortLink.ts), which carries the real file's
// extension and is null when the rendition doesn't exist — so the filters below
// gate on the same thing they always did, and nothing 404s.
function resultLink(r: UploadResult, variant: ShortLinkVariant): string {
  return (
    shortLink(
      { id: r.recordId, preview: r.avifUrl, original: r.originalUrl, sd: r.sdUrl },
      variant,
    ) ?? ''
  )
}
const allAvifUrls = computed(() =>
  selectedResults.value
    .filter((r) => r.avifUrl && r.filetype !== 'video')
    .map((r) => resultLink(r, 'preview'))
    .toReversed(),
)
const allHdUrls = computed(() =>
  selectedResults.value
    .filter((r) => r.originalUrl && (r.filetype === 'video' || r.filetype === 'gif'))
    .map((r) => resultLink(r, 'hd'))
    .toReversed(),
)
const allSdUrls = computed(() =>
  selectedResults.value
    .filter((r) => r.sdUrl && (r.filetype === 'video' || r.filetype === 'gif'))
    .map((r) => resultLink(r, 'sd'))
    .toReversed(),
)

// Rows that could contribute a link at all — the select-all checkbox reflects
// and toggles these, ignoring still-processing and failed uploads.
const selectableResults = computed(() => uploadResults.value.filter((r) => r.status === 'done'))
const allSelected = computed({
  get: () => selectableResults.value.length > 0 && selectableResults.value.every((r) => r.selected),
  set: (value: boolean) => {
    for (const r of selectableResults.value) r.selected = value
  },
})
const someSelected = computed(
  () => selectableResults.value.some((r) => r.selected) && !allSelected.value,
)

async function findMatchingSets(): Promise<any[]> {
  if (selectedIdols.value.length === 0 && inferredGroups.value.length === 0) return []

  const day = selectedDate.value ?? new Date()
  const dateStr = toLocalDateString(day)

  const idolFilters = selectedIdols.value
    .map((i: any) => pb.filter('idol ?~ {:id}', { id: i.id }))
    .join(' && ')
  const dateFilter = pb.filter('date >= {:start} && date <= {:end}', {
    start: `${dateStr} 00:00:00`,
    end: `${dateStr} 23:59:59`,
  })
  const filter = idolFilters ? `${dateFilter} && ${idolFilters}` : dateFilter

  try {
    const result = await pb.collection('contents_sets').getList(1, 20, {
      filter,
      expand: 'idol,group,uploader,uploader.user,contents_via_set',
      sort: '-created',
    })
    return result.items
  } catch {
    return []
  }
}

/**
 * Uploads `files`, returning whether anything landed.
 *
 * The boolean is what gates resetFormAfterUpload: a batch where every file
 * failed leaves the form and the staged files alone, so the retry is one click
 * rather than re-picking 50 files and re-entering the metadata.
 */
async function doUpload(files: File[], existingSetId: string | null): Promise<boolean> {
  let setId: string | null = existingSetId
  // Snapshotted once for the whole batch. Uploads run sequentially and the tab
  // buttons used to stay live, so clicking one mid-batch changed the filetype
  // of every file still queued — the other half of the .webm-as-image bug.
  const tab = selectedUploadType.value
  // Tracks a set we create in this call so we can roll it back if every
  // file upload then fails (avoids leaving an orphan empty set behind).
  let createdNewSetId: string | null = null

  // Resolved once for the files actually being uploaded — `files` can be
  // pendingFiles rather than selectedFiles, so this can't reuse the computed.
  const plan = files.map((file) => ({
    file,
    meta: resolveFileMeta(
      batchDefaults(),
      overrides.value[fileKey(file)],
      referenceStore.groups,
      file.name,
    ),
  }))
  const planned: ResolvedFile[] = plan.map(({ file, meta }) => ({
    key: fileKey(file),
    name: file.name,
    ...meta,
  }))

  // Same stand-down clearResults does: any rows still polling belong to a batch
  // that is about to be dropped from view, and without the bump each of them
  // keeps requesting its record for up to five more minutes.
  pollGeneration++
  uploadResults.value = []
  createdSetId.value = null
  createdSetTitle.value = null
  // Snapshotted so the results banner keeps naming where this batch went, even
  // after the picker is cleared for the next one.
  uploadedCollections.value = [...selectedCollections.value]

  if (!existingSetId && createsSet.value) {
    try {
      // The union of what the files actually carry, not the batch picker. With
      // per-file overrides those can differ, and the SET's idol/group is what
      // grouped idol filtering and My Feed read — a set listing fewer idols than
      // its children is exactly the blind spot that already loses sets when
      // someone adds to an existing one.
      const union = unionRelations(planned)
      const setTitle =
        title.value ||
        `${formatYYMMDD(selectedDate.value ?? new Date())} ${buildContentTitle(union.idol, union.group)}`.trim()

      // A set has no `mirror` for the backend to read provenance from, so the
      // page says which kind of batch this is. Only when EVERY file is an imgur
      // import — a mixed batch is a direct upload that happens to include some
      // recovered files. The backend accepts "imgur" from the client and
      // nothing else (see hooks/origin.go).
      const allFromImgur =
        plan.length > 0 && plan.every(({ file }) => !!imgurSources.value[fileKey(file)]?.served)

      const setData = {
        title: setTitle,
        idol: union.idol.map((idol: any) => idol.id),
        group: union.group.map((group: any) => group.id),
        uploader: [authStore.uploader?.id],
        date: toLocalDateString(selectedDate.value ?? new Date()),
        ...(allFromImgur ? { origin: 'imgur' } : {}),
      }
      const setRecord = await pb.collection('contents_sets').create(setData)
      setId = setRecord.id
      createdNewSetId = setRecord.id
      createdSetId.value = setRecord.id
      createdSetTitle.value = setData.title
      // Success toast is deferred until at least one file upload succeeds.
    } catch (err: any) {
      toast.add({
        title: 'Failed to create set',
        description: pbErrorDetail(err, 'Failed to create set.'),
        color: 'error',
        duration: 5000,
      })
      return false
    }
  } else if (existingSetId) {
    const existingSet = matchingSets.value.find((s) => s.id === existingSetId)
    createdSetId.value = existingSetId
    createdSetTitle.value = existingSet?.title ?? 'Set'

    if (authStore.uploader?.id) {
      try {
        const existingUploaderIds: string[] = existingSet?.uploader ?? []
        if (!existingUploaderIds.includes(authStore.uploader.id)) {
          await pb.collection('contents_sets').update(existingSetId, {
            'uploader+': authStore.uploader.id,
          })
        }
      } catch {
        // Non-fatal
      }
    }
  }

  for (const { file, meta } of plan) {
    const inferredFiletype = hintFiletype(file.name, file.type, tab)
    const formData = buildFormData(
      file,
      meta,
      uploadContext(setId, inferredFiletype),
      imgurSources.value[fileKey(file)]?.served,
    )

    const result = reactive<UploadResult>({
      fileName: file.name,
      fileSize: file.size,
      recordId: '',
      status: 'uploading',
      filetype: inferredFiletype,
      // Selected by default — the common case is copying everything just
      // uploaded, so deselecting is the exception.
      selected: true,
    })
    uploadResults.value.push(result)

    try {
      const record = await pb.collection('contents').create(formData)
      result.recordId = record.id
      result.status = 'processing'
      // original is typically available immediately on the record
      if (record.original) result.originalUrl = record.original
      if (record.sd) result.sdUrl = record.sd
      if (record.preview) result.avifUrl = record.preview

      // Poll for AVIF completion in background (parallel per file)
      pollForAvif(result)
    } catch (err: any) {
      const detail = pbErrorDetail(err, 'Upload failed')
      result.status = 'error'
      result.error = detail
      toast.add({
        title: `Failed: ${file.name}`,
        description: detail,
        color: 'error',
        duration: 5000,
      })
    }
  }

  // The records exist now, so the queue jumped by however many landed. Poll once
  // immediately rather than letting the 5s tick show a stale "0 in the queue"
  // right at the moment the uploader is looking for confirmation.
  void refreshQueue()

  const anySucceeded = uploadResults.value.some((r) => r.status !== 'error')

  // Nothing to roll back in collection mode, and deliberately so: the rollback
  // below exists only to avoid leaving an orphan EMPTY SET behind. A collection
  // already existed, and the records that did land are real content the user
  // wants — already visible in My Uploads and in the collection — so deleting
  // them because a sibling failed would destroy successful work.
  //
  // Roll back a freshly-created set if nothing landed in it.
  if (createdNewSetId && !anySucceeded) {
    try {
      await pb.collection('contents_sets').delete(createdNewSetId)
    } catch {
      // Non-fatal — leave cleanup to the backend if delete fails.
    }
    createdSetId.value = null
    createdSetTitle.value = null
  } else if (createdNewSetId && anySucceeded) {
    toast.add({
      title: 'Set Created',
      description: `Set "${createdSetTitle.value}" created successfully!`,
      color: 'success',
      duration: 3000,
    })
  }

  return anySucceeded
}

// Bumped whenever results are cleared or the page unmounts, so in-flight
// background polls know to stop mutating now-detached result objects.
let pollGeneration = 0

/**
 * How long to watch for a preview before letting go.
 *
 * The old budget was 60 × 2s. A queued 100 MB AV1 encode routinely runs past
 * that, and giving up was reported as a failed upload — the file was fine and
 * still encoding. Poll fast at first (most items finish in seconds), then back
 * off so a long encode doesn't cost hundreds of requests per file.
 */
const POLL_FAST_MS = 2000
const POLL_SLOW_MS = 5000
const POLL_FAST_ATTEMPTS = 15 // first ~30s
const POLL_BUDGET_MS = 5 * 60 * 1000

async function pollForAvif(result: UploadResult) {
  const gen = pollGeneration
  const startedAt = Date.now()
  for (let i = 0; Date.now() - startedAt < POLL_BUDGET_MS; i++) {
    await new Promise((r) => setTimeout(r, i < POLL_FAST_ATTEMPTS ? POLL_FAST_MS : POLL_SLOW_MS))
    if (gen !== pollGeneration) return
    try {
      const record = await pb.collection('contents').getOne(result.recordId, {
        // Unique request key per file avoids PocketBase auto-cancelling parallel polls
        requestKey: `poll_${result.recordId}_${i}`,
      })
      if (record.preview) {
        result.avifUrl = record.preview
        // The server may have reclassified the hint (see hintFiletype); the
        // links panel filters by this, so take the record's word for it.
        if (record.filetype) result.filetype = record.filetype as Filetype
        if (record.original) result.originalUrl = record.original
        // `sd` is best-effort backend-side — a record can legitimately finish
        // without it, so its absence must not hold up completion.
        if (record.sd) result.sdUrl = record.sd
        result.status = 'done'
        return
      }
    } catch {
      // record not ready yet, keep polling
    }
  }
  // NOT an error: the upload succeeded, the record exists, and the encoder is
  // still working. Saying "failed" here sent people back to re-upload files that
  // were about to appear.
  result.status = 'slow'
}

async function copyToClipboard(text: string, label = 'URL') {
  await navigator.clipboard.writeText(text)
  toast.add({
    title: `${label} copied`,
    description: text.length > 60 ? `${text.slice(0, 60)}…` : text,
    color: 'success',
    duration: 1500,
  })
}

async function copyAll(urls: string[], label: string) {
  if (urls.length === 0) return
  await navigator.clipboard.writeText(urls.join('\n'))
  toast.add({
    title: `Copied ${urls.length} ${label} link${urls.length === 1 ? '' : 's'}`,
    color: 'success',
    duration: 2000,
  })
}

function clearResults() {
  pollGeneration++
  uploadResults.value = []
  createdSetId.value = null
  createdSetTitle.value = null
}

onUnmounted(() => {
  // Stop background polls and release any cached file preview object URLs.
  pollGeneration++
  for (const url of objectUrlCache.values()) URL.revokeObjectURL(url)
  objectUrlCache.clear()
})

/**
 * Empty the picker, releasing each staged file's preview URL, and stand the
 * validation state back down.
 *
 * Dropping hasAttemptedUpload here — BEFORE selectedFiles changes, so the live
 * validation watch early-returns instead of recomputing against zero files — is
 * the actual bug fix. Emptying the picker used to leave the flag true, so
 * "Select at least one file to upload." appeared the moment an upload started:
 * an error about the batch that had just succeeded. With no files staged there is
 * nothing to validate yet, which is equally true of the Clear button.
 */
function clearStagedFiles() {
  hasAttemptedUpload.value = false
  errors.value = {}
  fileErrors.value = {}
  for (const file of selectedFiles.value) revokeObjectUrl(file)
  selectedFiles.value = []
}

/**
 * Return the form to its pristine state after a batch has landed.
 *
 * The upload type and destination mode deliberately survive: they describe how
 * this uploader works, not what they just uploaded, and the next batch is
 * usually the same kind of thing.
 */
function resetFormAfterUpload() {
  clearStagedFiles()
  // The selectedFiles watch prunes these anyway; done here so a re-render in the
  // same tick can't see overrides for files that are gone.
  overrides.value = {}
  imgurSources.value = {}

  title.value = ''
  selectedIdols.value = []
  selectedTags.value = []
  selectedDate.value = null
  source.value = ''
  // Safe for the results banner: it reads the uploadedCollections snapshot
  // doUpload took, not this picker.
  selectedCollections.value = []
}

async function customUploader() {
  // Re-entry guard — covers the whole run, including the set-match lookup, so a
  // double-click during any of its awaits can't start a parallel batch.
  if (isUploading.value) return
  if (!canUpload.value) {
    toast.add({
      title: 'Upload access required',
      description:
        'Your account does not have upload permissions. Request access via email or Discord.',
      color: 'error',
      duration: 3000,
    })
    return
  }

  const files: File[] = [...selectedFiles.value]

  const cfg = uploadTypeConfig[selectedUploadType.value]
  if (files.length > cfg.maxFiles) {
    toast.add({
      title: 'Too many files',
      description: `Max ${cfg.maxFiles} file${cfg.maxFiles === 1 ? '' : 's'} for ${cfg.label} uploads.`,
      color: 'error',
      duration: 3000,
    })
    return
  }

  hasAttemptedUpload.value = true
  if (!validate(files)) {
    const count = Object.keys(errors.value).length
    toast.add({
      title: `Fix ${count} issue${count === 1 ? '' : 's'} before uploading`,
      description: Object.values(errors.value)[0],
      color: 'error',
      duration: 4000,
    })
    // Scroll errors banner into view
    document
      .querySelector('.validation-banner')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  isUploading.value = true
  try {
    // Only a set destination looks for a set to join. Collection mode always
    // accepts the collection the user picked, whatever its date or idols.
    if (createsSet.value) {
      const matches = await findMatchingSets()
      if (matches.length > 0) {
        matchingSets.value = matches
        pendingFiles.value = files
        isSetMergeDialogVisible.value = true
        // Released by the finally: nothing is uploading while the dialog waits,
        // and its merge/create handlers re-arm the guard themselves.
        return
      }
    }

    if (await doUpload(files, null)) resetFormAfterUpload()
  } finally {
    isUploading.value = false
  }
}

async function onMergeSet(existingSetId: string) {
  if (isUploading.value) return
  isSetMergeDialogVisible.value = false
  isUploading.value = true
  try {
    const succeeded = await doUpload(pendingFiles.value, existingSetId)
    pendingFiles.value = []
    if (succeeded) resetFormAfterUpload()
  } finally {
    isUploading.value = false
  }
}

async function onCreateNewSet() {
  if (isUploading.value) return
  isSetMergeDialogVisible.value = false
  isUploading.value = true
  try {
    const succeeded = await doUpload(pendingFiles.value, null)
    pendingFiles.value = []
    if (succeeded) resetFormAfterUpload()
  } finally {
    isUploading.value = false
  }
}

watch(
  () => authStore.uploader,
  (val) => {
    if (val) isCreateUploaderVisible.value = false
  },
)

onMounted(async () => {
  // Handoff from /tools — the same localStorage one-shot usePageTitleHandoff
  // uses. Read and removed immediately so a later visit doesn't resurrect a
  // batch the uploader has moved on from.
  const handedOff = localStorage.getItem(IMGUR_HANDOFF_KEY)
  if (handedOff) {
    localStorage.removeItem(IMGUR_HANDOFF_KEY)
    imgurHandoffLinks.value = handedOff
    // Opened rather than silently staged: the fetch costs the uploader
    // bandwidth, so it stays an explicit action.
    isImgurImportVisible.value = true
  }

  await referenceStore.ensureLoaded()
  if (authStore.isValid && !authStore.uploader) isCreateUploaderVisible.value = true

  // Loaded up front rather than when collection mode is picked: it's one small
  // per-user query, and having the list ready means the destination toggle
  // doesn't stall on a spinner the first time it's used.
  if (canUpload.value) {
    // Only for people who can actually upload — nobody else has a wait to
    // understand, and the endpoint needs auth.
    startQueuePolling()

    try {
      await loadMyCollections()
    } catch {
      toast.add({
        title: 'Could not load your collections',
        description: 'Uploading to a set still works. Reload to try again.',
        color: 'warning',
        duration: 4000,
      })
    }
  }
})
</script>

<template>
  <div>
    <NavigationUploads class="mt-6" />

    <!-- Page title -->
    <div class="flex justify-center items-center mb-6 mt-4">
      <h1 class="text-3xl font-semibold gradient-text tracking-tight">Upload</h1>
    </div>

    <!-- Upload permission banner -->
    <div
      v-if="!canUpload"
      class="glass-card p-6 mb-6 border-amber-400/30! max-w-md mx-auto text-center"
    >
      <div class="flex flex-col items-center gap-3">
        <div
          class="w-12 h-12 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center"
        >
          <UIcon name="i-lucide-lock" class="text-amber-400 text-xl" />
        </div>
        <div>
          <p class="text-base font-semibold text-amber-300">Upload access required</p>
          <p class="text-xs text-night-400 mt-1.5 leading-relaxed">
            Uploading is restricted to verified uploaders. To request access, reach out through one
            of the options below.
          </p>
        </div>
        <div class="flex flex-wrap justify-center gap-2 mt-1">
          <a
            :href="`mailto:${supportEmail}?subject=Upload%20access%20request`"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-pink-500/15 text-pink-300 border border-pink-500/25 hover:bg-pink-500/25 transition-colors"
          >
            <UIcon name="i-lucide-mail" class="text-xs" />
            Email us
          </a>
          <a
            :href="discordInvite"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500/15 text-violet-300 border border-violet-500/25 hover:bg-violet-500/25 transition-colors"
          >
            <UIcon name="i-simple-icons-discord" class="text-xs" />
            Join Discord
          </a>
        </div>
      </div>
    </div>

    <div
      :class="!canUpload ? 'opacity-40 pointer-events-none select-none blur-[1px]' : ''"
      :aria-disabled="!canUpload"
    >
      <!-- Validation summary banner -->
      <div
        v-if="errorCountSummary > 0"
        class="validation-banner glass-card p-4 mb-4 border-red-400/30!"
      >
        <div class="flex items-start gap-3">
          <UIcon name="i-lucide-circle-alert" class="text-red-400 text-xl mt-0.5" />
          <div class="flex-1">
            <p class="text-sm font-semibold text-red-300">
              {{ errorCountSummary }} issue{{ errorCountSummary === 1 ? '' : 's' }} preventing
              upload
            </p>
            <ul class="text-xs text-night-400 mt-1 space-y-0.5 list-disc list-inside">
              <li v-for="(msg, key) in errors" :key="key">
                {{ msg }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Main upload panel -->
      <div class="glass-card p-6">
        <!-- Upload form -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Metadata column -->
          <div class="flex flex-col gap-4">
            <!-- Destination heads THIS column rather than spanning both. It
                 governs what the metadata below it means (per-batch for a set,
                 per-file for a collection), so it belongs above the metadata and
                 nowhere near the file picker — which is unaffected by it and now
                 keeps the full height of the right-hand column.
                 Hidden for stickers, which never form an album. -->
            <div v-if="canChooseDestination" class="flex flex-col gap-1.5">
              <span class="micro-label text-pink-300">Destination</span>
              <div class="flex gap-2 p-1 rounded-xl bg-white/3 border border-white/8">
                <button
                  v-for="option in [
                    {
                      value: 'set' as const,
                      label: 'New set',
                      icon: 'i-lucide-film',
                      hint: 'Related content — same performance or day',
                    },
                    {
                      value: 'collection' as const,
                      label: 'Collection',
                      icon: 'i-lucide-images',
                      hint: 'Unrelated content, into a collection you own',
                    },
                  ]"
                  :key="option.value"
                  type="button"
                  class="flex-1 flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg transition-colors duration-200 cursor-pointer text-left"
                  :class="
                    uploadMode === option.value
                      ? 'bg-pink-500/15 border border-pink-400/40'
                      : 'border border-transparent hover:bg-white/4'
                  "
                  @click="uploadMode = option.value"
                >
                  <span class="flex items-center gap-1.5">
                    <UIcon
                      :name="option.icon"
                      :class="uploadMode === option.value ? 'text-pink-300' : 'text-night-500'"
                    />
                    <span
                      class="text-sm font-medium"
                      :class="uploadMode === option.value ? 'text-night-50' : 'text-night-300'"
                    >
                      {{ option.label }}
                    </span>
                  </span>
                  <span class="text-xs text-night-500">{{ option.hint }}</span>
                </button>
              </div>
            </div>

            <h2 class="micro-label text-pink-300">Metadata</h2>

            <!-- First field in collection mode: it's the destination, so it
                 outranks the metadata below it. Any collection you own is
                 offered — unlike set matching, date and idols are irrelevant. -->
            <div
              v-if="uploadMode === 'collection' && canChooseDestination"
              class="flex flex-col gap-1"
            >
              <label class="text-xs text-night-400 font-medium">
                Collection <span class="text-red-400">*</span>
              </label>
              <div class="flex gap-2">
                <USelectMenu
                  v-model="selectedCollections"
                  multiple
                  by="id"
                  :items="myCollections"
                  :loading="isLoadingCollections"
                  label-key="title"
                  placeholder="Select collections..."
                  class="flex-1 min-w-0"
                  :color="errors.collection ? 'error' : undefined"
                  :highlight="!!errors.collection"
                />
                <UButton
                  icon="i-lucide-plus"
                  color="neutral"
                  variant="outline"
                  aria-label="New collection"
                  @click="openCreateCollection"
                />
              </div>
              <small v-if="errors.collection" class="text-red-400 text-sm mt-0.5">
                {{ errors.collection }}
              </small>
              <small v-else class="text-night-500 text-sm">
                No set is created — these land in the collection and on the home page in ungrouped
                view.
              </small>
            </div>

            <div class="flex flex-col gap-1">
              <label for="idols" class="text-xs text-night-400 font-medium">
                Idols <span class="text-red-400">*</span>
              </label>
              <IdolSelectMenu
                v-model="selectedIdols"
                :color="errors.idol ? 'error' : undefined"
                :highlight="!!errors.idol"
              />
              <small v-if="errors.idol" class="text-red-400 text-sm mt-0.5">{{
                errors.idol
              }}</small>
            </div>

            <div v-if="inferredGroups.length" class="flex flex-wrap gap-1.5">
              <UBadge
                v-for="g in inferredGroups"
                :key="(g as any).id"
                icon="i-lucide-at-sign"
                color="info"
                variant="soft"
                :label="(g as any).name"
                class="select-none text-xs!"
              />
            </div>

            <div class="flex flex-col gap-1">
              <label for="title" class="text-xs text-night-400 font-medium">
                Title <span v-if="selectedUploadType === 'sticker'" class="text-red-400">*</span>
              </label>
              <UInput
                id="title"
                v-model="title"
                :placeholder="autoGeneratedTitle"
                :color="errors.title ? 'error' : undefined"
                :highlight="!!errors.title"
              />
              <small v-if="errors.title" class="text-red-400 text-sm mt-0.5">{{
                errors.title
              }}</small>
            </div>

            <template v-if="selectedUploadType !== 'sticker'">
              <div class="flex flex-col gap-1">
                <label for="tags" class="text-xs text-night-400 font-medium">Tags</label>
                <USelectMenu
                  v-model="selectedTags"
                  multiple
                  by="id"
                  :items="referenceStore.tags"
                  label-key="name"
                  placeholder="Select tags..."
                />
              </div>

              <div class="flex flex-col gap-1">
                <label for="date" class="text-xs text-night-400 font-medium">
                  Date
                  <span class="text-night-500 font-normal">(optional — defaults to today)</span>
                </label>
                <DateField v-model="selectedDateModel" />
              </div>
            </template>

            <div class="flex flex-col gap-1">
              <label for="source" class="text-xs text-night-400 font-medium">
                Source <span class="text-night-600 text-xs">(optional URL)</span>
              </label>
              <UInput
                id="source"
                v-model="source"
                placeholder="https://youtube.com/..., https://instagram.com/..."
                :color="errors.source ? 'error' : undefined"
                :highlight="!!errors.source"
              />
              <small v-if="errors.source" class="text-red-400 text-sm mt-0.5">{{
                errors.source
              }}</small>
            </div>

            <div
              v-if="selectedUploadType !== 'sticker' && (selectedDate || selectedIdols.length)"
              class="mt-1 p-3 rounded-lg border border-white/6 bg-white/3"
            >
              <p class="text-xs uppercase tracking-wider text-night-500 font-semibold mb-1">
                Preview
              </p>
              <p class="text-xs text-night-300 font-mono">
                <span class="text-night-500">Single:</span> {{ title || autoGeneratedTitle }}
              </p>
              <!-- Only when a set is actually being created. -->
              <p v-if="createsSet" class="text-xs text-night-300 font-mono mt-0.5">
                <span class="text-night-500">Set:</span> {{ title || autoGeneratedSetTitle }}
              </p>
            </div>
          </div>

          <!-- File upload column -->
          <div class="flex flex-col gap-2">
            <!-- Type tabs -->
            <div class="flex gap-1 p-1 rounded-xl bg-white/4 border border-white/6 mb-1">
              <button
                v-for="(config, type) in uploadTypeConfig"
                :key="type"
                class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer"
                :class="
                  selectedUploadType === type
                    ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                    : 'text-night-400 hover:text-night-200 border border-transparent'
                "
                :disabled="isUploading"
                @click="selectedUploadType = type as UploadType"
              >
                <UIcon :name="config.icon" />
                {{ config.label }}
              </button>
            </div>
            <p class="text-xs text-night-500 font-mono mb-1">
              {{ uploadTypeConfig[selectedUploadType].description }}
            </p>
            <h2 class="micro-label text-pink-300">Files</h2>
            <!-- Above the dropzone on purpose: the backlog is something to know
                 BEFORE committing a 50-gif batch, not after. -->
            <UploadQueueStatus
              :snapshot="queueSnapshot"
              :staged-count="selectedFiles.length"
              :mine-in-queue="processingCount"
            />
            <UFileUpload
              :key="selectedUploadType"
              v-model="fileUploadModel"
              :multiple="isMultipleUpload"
              :accept="uploadTypeConfig[selectedUploadType].accept"
              :disabled="!canUpload"
              :interactive="false"
              :preview="false"
              variant="area"
              layout="list"
              position="outside"
              class="upload-dropzone"
              :ui="{
                base: 'border border-dashed border-white/12 rounded-xl bg-transparent transition-colors data-[dragging=true]:border-pink-400/60 data-[dragging=true]:bg-pink-500/5',
                wrapper: 'flex-col-reverse items-stretch text-left px-0 py-0',
                actions: 'mt-0 w-full',
              }"
            >
              <template #actions="{ open }">
                <div class="flex flex-wrap gap-2 items-center w-full">
                  <UButton
                    icon="i-lucide-images"
                    label="Choose"
                    color="neutral"
                    variant="outline"
                    :disabled="!canUpload"
                    @click="open()"
                  />
                  <!-- Beside Choose because it is the same job: getting files
                       into the staging area. Everything downstream then treats
                       them as ordinary picked files. -->
                  <UButton
                    icon="i-lucide-link"
                    label="From Imgur"
                    color="neutral"
                    variant="outline"
                    :disabled="!canUpload || remainingFileSlots < 1"
                    @click="openImgurImport()"
                  />
                  <UButton
                    icon="i-lucide-cloud-upload"
                    label="Upload"
                    class="search-gradient"
                    :loading="isUploading"
                    :disabled="!selectedFiles.length || !canUpload || isUploading"
                    @click="customUploader()"
                  />
                  <UButton
                    icon="i-lucide-x"
                    label="Clear"
                    color="error"
                    variant="outline"
                    :disabled="!selectedFiles.length"
                    @click="clearStagedFiles()"
                  />
                  <div class="ml-auto text-sm text-night-500 font-mono">
                    {{ selectedFiles.length }} selected
                  </div>
                </div>
              </template>
              <!-- Everything lives in #leading, and the built-in preview is off,
                   because with position="outside" the #files slot renders as a
                   SIBLING of the dropzone element — so dropping onto the staged
                   thumbnails, the natural target, did nothing. The drop listener
                   was always live; it was just invisible (:ui.base killed the
                   dashed border) and collapsed to the button row once the
                   prompt below was v-if'd away.

                   :interactive stays false: setting it true puts @click="open()"
                   on this same element, so clicking Upload or Clear would also
                   open the file picker. The Choose button covers click-to-pick. -->
              <template #leading>
                <!-- Empty state -->
                <div
                  v-if="!selectedFiles.length"
                  class="flex items-center justify-center flex-col py-8 w-full"
                >
                  <UIcon name="i-lucide-cloud-upload" class="text-5xl text-night-600 mb-3" />
                  <p class="text-night-400 text-sm">Drag and drop files here to upload</p>
                  <p class="text-sm text-night-500 mt-3 font-mono">
                    max {{ uploadTypeConfig[selectedUploadType].maxFiles }}
                    {{ uploadTypeConfig[selectedUploadType].maxFiles === 1 ? 'file' : 'files' }} ·
                    {{ uploadTypeConfig[selectedUploadType].maxFileSizeMB }}MB each ·
                    {{ uploadTypeConfig[selectedUploadType].maxTotalSizeMB }}MB total
                  </p>
                  <p class="text-xs text-night-600 mt-0.5 font-mono">
                    {{ uploadTypeConfig[selectedUploadType].hint }}
                  </p>
                </div>

                <!-- Staged files + a drop target that stays advertised -->
                <div v-else class="w-full">
                  <!-- Grid ⇄ Details. Grid stays the default; Details is where
                       per-file metadata is edited, one row per file, so 50
                       unrelated gifs don't mean 50 popovers. -->
                  <div class="flex items-center justify-between gap-2 px-4 pt-4">
                    <span class="text-sm text-night-500 font-mono">
                      {{ selectedFiles.length }} staged
                    </span>
                    <div class="flex gap-1 p-0.5 rounded-lg bg-white/3 border border-white/8">
                      <button
                        v-for="view in [
                          { value: 'grid' as const, icon: 'i-lucide-grid-2x2', label: 'Grid' },
                          { value: 'details' as const, icon: 'i-lucide-rows-3', label: 'Details' },
                        ]"
                        :key="view.value"
                        type="button"
                        class="flex items-center gap-1 px-2 py-1 rounded-md text-sm transition-colors duration-200 cursor-pointer"
                        :class="
                          stagedView === view.value
                            ? 'bg-pink-500/15 text-night-50'
                            : 'text-night-400 hover:bg-white/4'
                        "
                        @click="stagedView = view.value"
                      >
                        <UIcon :name="view.icon" />
                        {{ view.label }}
                      </button>
                    </div>
                  </div>

                  <!-- Details: one editable row per file. v-if, not v-show, so
                       grid mode doesn't mount 50 select menus. -->
                  <div v-if="stagedView === 'details'" class="flex flex-col gap-2 px-4 pt-3">
                    <div
                      v-for="(row, index) of resolvedFiles"
                      :key="row.key"
                      class="flex items-start gap-3 p-2 rounded-lg border bg-white/3"
                      :class="fileErrors[row.key]?.length ? 'border-red-400/40' : 'border-white/8'"
                    >
                      <div
                        class="w-16 h-16 shrink-0 rounded-md overflow-hidden bg-black/30 flex items-center justify-center"
                      >
                        <img
                          v-if="selectedFiles[index]?.type.startsWith('image')"
                          :src="getObjectUrl(selectedFiles[index])"
                          class="w-full h-full object-cover"
                          :alt="row.name"
                        />
                        <video
                          v-else-if="selectedFiles[index]?.type.startsWith('video')"
                          :src="getObjectUrl(selectedFiles[index])"
                          class="w-full h-full object-cover"
                          muted
                          preload="metadata"
                          playsinline
                        />
                        <UIcon v-else name="i-lucide-file" class="text-night-600" />
                      </div>

                      <div class="flex-1 min-w-0 flex flex-col gap-1.5">
                        <div class="flex items-center gap-2 min-w-0">
                          <p class="text-sm text-night-300 font-mono truncate flex-1">
                            {{ row.name }}
                          </p>
                          <UBadge
                            v-if="isEdited(row.key)"
                            color="primary"
                            variant="soft"
                            size="sm"
                            label="edited"
                            class="shrink-0"
                          />
                          <UButton
                            v-if="isEdited(row.key)"
                            icon="i-lucide-rotate-ccw"
                            color="neutral"
                            variant="ghost"
                            size="xs"
                            square
                            title="Reset to the batch metadata"
                            aria-label="Reset to the batch metadata"
                            @click="resetOverride(row.key)"
                          />
                          <UButton
                            icon="i-lucide-x"
                            color="error"
                            variant="ghost"
                            size="xs"
                            square
                            aria-label="Remove file"
                            @click="removeSelectedFile(selectedFiles[index]!, index)"
                          />
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          <IdolSelectMenu
                            :model-value="row.idol"
                            size="sm"
                            :color="fileErrors[row.key]?.length ? 'error' : undefined"
                            @update:model-value="setOverride(row.key, 'idol', $event)"
                          />
                          <USelectMenu
                            v-if="selectedUploadType !== 'sticker'"
                            :model-value="row.tag"
                            multiple
                            by="id"
                            :items="referenceStore.tags"
                            label-key="name"
                            placeholder="Tags..."
                            size="sm"
                            @update:model-value="setOverride(row.key, 'tag', $event)"
                          />
                          <UInput
                            :model-value="overrides[row.key]?.title ?? ''"
                            :placeholder="row.title"
                            size="sm"
                            @update:model-value="setOverride(row.key, 'title', String($event))"
                          />
                          <!-- Per-file date only in collection mode: in set mode
                               the date defines the set and its matching, so files
                               dated differently inside one set are incoherent. -->
                          <DateField
                            v-if="uploadMode === 'collection' && canChooseDestination"
                            :model-value="toCal(row.date)"
                            size="sm"
                            @update:model-value="setOverride(row.key, 'date', fromCal($event))"
                          />
                        </div>

                        <p v-if="fileErrors[row.key]?.length" class="text-xs text-red-400">
                          {{ fileErrors[row.key]!.join(' ') }}
                        </p>
                        <p v-else class="text-xs text-night-500 truncate">
                          {{ row.idol.map((i: any) => i.name).join(', ') || 'No idol' }}
                          <span v-if="row.group.length" class="text-night-600">
                            · {{ row.group.map((g: any) => g.name).join(', ') }}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div v-else class="flex flex-wrap gap-3 px-4 pt-4">
                    <div
                      v-for="(file, index) of selectedFiles"
                      :key="fileKey(file)"
                      class="relative w-28 h-28 rounded-lg overflow-hidden border border-white/8 bg-white/3 group"
                    >
                      <img
                        v-if="file.type.startsWith('image')"
                        :src="getObjectUrl(file)"
                        class="w-full h-full object-cover"
                        :alt="file.name"
                      />
                      <video
                        v-else-if="file.type.startsWith('video')"
                        :src="getObjectUrl(file)"
                        class="w-full h-full object-cover"
                        muted
                        preload="metadata"
                        playsinline
                      />
                      <div
                        class="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/80 to-transparent"
                      >
                        <p class="text-xs text-white truncate font-mono">
                          {{ file.name }}
                        </p>
                        <p class="text-xs text-night-400 font-mono">
                          {{ formatSize(file.size) }}
                        </p>
                      </div>
                      <UButton
                        icon="i-lucide-x"
                        color="error"
                        size="xs"
                        square
                        aria-label="Remove file"
                        class="rounded-full justify-center absolute top-1 right-1 w-6! h-6! opacity-0 group-hover:opacity-100 transition-opacity"
                        @click="removeSelectedFile(file, index)"
                      />
                      <!-- Visible in Grid too, so per-file edits and per-file
                           problems aren't hidden behind the view toggle. -->
                      <span
                        v-if="fileErrors[fileKey(file)]?.length"
                        class="absolute top-1 left-1 flex items-center justify-center w-4 h-4 rounded-full bg-red-500"
                        :title="fileErrors[fileKey(file)]!.join(' ')"
                      >
                        <UIcon name="i-lucide-alert-triangle" class="text-xs text-white" />
                      </span>
                      <span
                        v-else-if="isEdited(fileKey(file))"
                        class="absolute top-1 left-1 w-2 h-2 rounded-full bg-pink-400"
                        title="Has its own metadata"
                      />
                    </div>
                  </div>

                  <div
                    class="flex items-center justify-center gap-2 px-4 py-3 text-sm text-night-500 font-mono"
                  >
                    <UIcon name="i-lucide-plus" class="text-sm" />
                    <span
                      v-if="selectedFiles.length < uploadTypeConfig[selectedUploadType].maxFiles"
                    >
                      Drop more files here — {{ selectedFiles.length }}/{{
                        uploadTypeConfig[selectedUploadType].maxFiles
                      }}
                      selected
                    </span>
                    <span v-else>
                      Limit reached — {{ selectedFiles.length }}/{{
                        uploadTypeConfig[selectedUploadType].maxFiles
                      }}
                      selected
                    </span>
                  </div>
                </div>
              </template>
            </UFileUpload>
          </div>
        </div>
      </div>

      <!-- Results panel -->
      <div v-if="uploadResults.length" class="glass-card p-5 mt-5">
        <!-- Where it landed: one row for a set, or one per collection. Banner
             level rather than per row, because every file in a batch shares the
             same destination. -->
        <NuxtLink
          v-for="destination in destinationLinks"
          :key="destination.to"
          :to="processingCount ? '' : destination.to"
          class="flex items-center gap-3 mb-4 p-3 rounded-xl border transition-all duration-200 group"
          :class="
            processingCount
              ? 'border-white/8 bg-white/3 opacity-50 pointer-events-none'
              : 'border-pink-500/25 bg-pink-500/5 hover:bg-pink-500/10 hover:border-pink-500/40'
          "
        >
          <UIcon :name="destination.icon" class="text-pink-300" />
          <div class="flex-1 min-w-0">
            <p class="text-xs uppercase tracking-wider text-pink-400/80 font-semibold">
              {{ destination.label }}
            </p>
            <p class="text-sm text-night-100 truncate">
              {{ destination.title }}
            </p>
          </div>
          <UIcon
            name="i-lucide-arrow-up-right"
            class="text-pink-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200"
          />
        </NuxtLink>

        <!-- Results header -->
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div class="flex items-center gap-3">
            <h2 class="text-lg font-semibold text-night-100">Results</h2>
            <div class="flex items-center gap-2 text-sm font-mono">
              <span
                v-if="doneCount"
                class="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
              >
                {{ doneCount }} done
              </span>
              <span
                v-if="processingCount"
                class="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25"
              >
                {{ processingCount }} processing
              </span>
              <span
                v-if="errorCount"
                class="px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/25"
              >
                {{ errorCount }} failed
              </span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UCheckbox
              v-if="selectableResults.length"
              v-model="allSelected"
              :indeterminate="someSelected"
              label="Select all"
              size="sm"
              class="mr-1"
            />
            <UButton
              v-if="allAvifUrls.length"
              :label="`Copy Preview Links (${allAvifUrls.length})`"
              icon="i-simple-icons-discord"
              size="sm"
              color="neutral"
              variant="outline"
              title="Discord-ready preview links"
              :disabled="!!processingCount"
              @click="copyAll(allAvifUrls, 'Preview')"
            />
            <UButton
              v-if="allSdUrls.length"
              :label="`Copy SD Links (${allSdUrls.length})`"
              icon="i-lucide-copy"
              size="sm"
              color="neutral"
              variant="outline"
              title="H.264 720p — plays everywhere"
              :disabled="!!processingCount"
              @click="copyAll(allSdUrls, 'SD')"
            />
            <UButton
              v-if="allHdUrls.length"
              :label="`Copy HD Links (${allHdUrls.length})`"
              icon="i-lucide-copy"
              size="sm"
              color="neutral"
              variant="outline"
              title="AV1 1080p — best quality"
              :disabled="!!processingCount"
              @click="copyAll(allHdUrls, 'HD')"
            />
            <UButton
              icon="i-lucide-trash-2"
              size="sm"
              color="error"
              variant="outline"
              aria-label="Clear"
              @click="clearResults"
            />
          </div>
        </div>

        <!-- Results list -->
        <div class="flex flex-col gap-2">
          <div
            v-for="result in uploadResults"
            :key="result.fileName + result.recordId"
            class="flex items-stretch gap-3 p-3 rounded-xl border border-white/8 bg-white/3 hover:border-pink-500/25 transition-colors duration-200"
          >
            <!-- Include in the copy-all buttons. Only meaningful once a row has
                 links, so it stays hidden until the row is done. -->
            <div class="flex items-center shrink-0">
              <UCheckbox
                v-if="result.status === 'done'"
                v-model="result.selected"
                size="sm"
                :aria-label="`Include ${result.fileName} when copying`"
              />
              <div v-else class="w-4" />
            </div>

            <!-- Thumbnail -->
            <div
              class="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-black/30 flex items-center justify-center"
            >
              <template v-if="result.status === 'done' && (result.avifUrl || result.originalUrl)">
                <!--
                  SD, not the AV1 original: this is an 80×80 box, and AV1 decodes
                  in software on a lot of machines while H.264 is hardware-decoded
                  almost everywhere — which is what made the results list stutter,
                  more than the file size did.

                  `preview` is not an option here: for video records the backend
                  sets it to the same MP4 as `original` (there is no animated
                  still for a video), so it would change nothing. `sd` is
                  best-effort server-side, hence the fallback.
                -->
                <video
                  v-if="result.filetype === 'video'"
                  :src="result.sdUrl || result.originalUrl"
                  class="w-full h-full object-cover"
                  muted
                  preload="metadata"
                />
                <img
                  v-else
                  :src="result.avifUrl"
                  class="w-full h-full object-cover"
                  :alt="result.fileName"
                />
              </template>
              <UIcon
                v-else-if="result.status === 'uploading'"
                name="i-lucide-loader-circle"
                class="animate-spin text-night-500 text-xl"
              />
              <UIcon
                v-else-if="result.status === 'processing'"
                name="i-lucide-settings"
                class="animate-spin text-amber-400 text-xl"
              />
              <UIcon
                v-else-if="result.status === 'slow'"
                name="i-lucide-clock"
                class="text-amber-400 text-xl"
              />
              <UIcon v-else name="i-lucide-circle-x" class="text-red-400 text-xl" />
            </div>

            <!-- Info + links -->
            <div class="flex-1 min-w-0 flex flex-col justify-between gap-1">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-night-100 truncate" :title="result.fileName">
                    {{ result.fileName }}
                  </p>
                  <p class="text-xs text-night-500 font-mono">
                    {{ formatSize(result.fileSize) }} · {{ result.filetype }}
                  </p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <NuxtLink
                    v-if="result.status === 'done' && result.recordId"
                    :to="`/single/${result.recordId}`"
                    class="text-xs uppercase tracking-wider text-pink-400 hover:text-pink-300 font-semibold flex items-center gap-1 transition-colors"
                  >
                    View
                    <UIcon name="i-lucide-arrow-up-right" class="text-xs" />
                  </NuxtLink>
                </div>
              </div>

              <div v-if="result.status === 'done'" class="flex flex-col gap-1">
                <div
                  v-if="result.avifUrl && result.filetype !== 'video'"
                  class="flex items-center gap-2 text-xs"
                >
                  <span
                    class="inline-flex items-center px-1.5 py-0.5 rounded bg-[#5865F2]/15 text-[#8b93f4] border border-[#5865F2]/30 shrink-0"
                    title="Discord-ready preview"
                    aria-label="Discord-ready preview"
                  >
                    <UIcon name="i-simple-icons-discord" class="text-sm" />
                  </span>
                  <span
                    class="font-mono text-sm text-night-400 truncate flex-1"
                    :title="result.avifUrl"
                  >
                    {{ resultLink(result, 'preview') }}
                  </span>
                  <button
                    class="shrink-0 text-night-500 hover:text-pink-300 transition-colors"
                    title="Copy for Discord"
                    @click="copyToClipboard(resultLink(result, 'preview'), 'Discord link')"
                  >
                    <UIcon name="i-lucide-copy" class="text-xs" />
                  </button>
                </div>

                <div
                  v-if="
                    result.originalUrl && (result.filetype === 'video' || result.filetype === 'gif')
                  "
                  class="flex items-center gap-2 text-xs"
                >
                  <span
                    class="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/25 font-mono text-xs font-bold shrink-0"
                    title="AV1 1080p — best quality, needs a modern decoder"
                  >
                    HD
                  </span>
                  <span
                    class="font-mono text-sm text-night-400 truncate flex-1"
                    :title="result.originalUrl"
                  >
                    {{ resultLink(result, 'hd') }}
                  </span>
                  <button
                    class="shrink-0 text-night-500 hover:text-violet-300 transition-colors"
                    title="Copy HD URL"
                    @click="copyToClipboard(resultLink(result, 'hd'), 'HD')"
                  >
                    <UIcon name="i-lucide-copy" class="text-xs" />
                  </button>
                </div>

                <div
                  v-if="result.sdUrl && (result.filetype === 'video' || result.filetype === 'gif')"
                  class="flex items-center gap-2 text-xs"
                >
                  <span
                    class="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25 font-mono text-xs font-bold shrink-0"
                    title="H.264 720p — plays everywhere, including older iPhones"
                  >
                    SD
                  </span>
                  <span
                    class="font-mono text-sm text-night-400 truncate flex-1"
                    :title="result.sdUrl"
                  >
                    {{ resultLink(result, 'sd') }}
                  </span>
                  <button
                    class="shrink-0 text-night-500 hover:text-sky-300 transition-colors"
                    title="Copy SD URL"
                    @click="copyToClipboard(resultLink(result, 'sd'), 'SD')"
                  >
                    <UIcon name="i-lucide-copy" class="text-xs" />
                  </button>
                </div>
              </div>

              <p v-else-if="result.status === 'error'" class="text-xs text-red-400">
                {{ result.error }}
              </p>
              <p v-else-if="result.status === 'slow'" class="text-xs text-amber-400">
                Uploaded — still encoding. It'll show up in
                <NuxtLink to="/me/uploads" class="underline hover:text-amber-300"
                  >My Uploads</NuxtLink
                >
                shortly.
              </p>
              <p v-else class="text-xs text-night-500 italic">
                {{ result.status === 'uploading' ? 'Uploading...' : 'Generating preview...' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <DialogImgurImport
      v-if="isImgurImportVisible"
      :is-visible="isImgurImportVisible"
      :remaining="remainingFileSlots"
      :max-file-size-mb="uploadTypeConfig[selectedUploadType].maxFileSizeMB"
      :accept="uploadTypeConfig[selectedUploadType].accept"
      :staged="Object.values(imgurSources).map((s) => s.requested)"
      :type-label="uploadTypeConfig[selectedUploadType].label"
      :initial-links="imgurHandoffLinks"
      @update:is-visible="isImgurImportVisible = $event"
      @imported="onImgurImported"
    />
    <DialogCreateUploader
      v-if="isCreateUploaderVisible"
      :is-visible="isCreateUploaderVisible"
      @update:is-visible="isCreateUploaderVisible = $event"
      @created="isCreateUploaderVisible = false"
    />
    <DialogUploadSetMatch
      v-if="isSetMergeDialogVisible"
      :is-visible="isSetMergeDialogVisible"
      :matching-sets="matchingSets"
      :new-set-title="title || autoGeneratedSetTitle"
      @update:is-visible="isSetMergeDialogVisible = $event"
      @merge="onMergeSet"
      @create-new="onCreateNewSet"
    />
    <!-- Reused rather than a second create form: it already owns
         useCreateCollection, the auth gate, toasts and reset-on-open. -->
    <DialogCreateCollection
      v-if="isCreateCollectionVisible"
      :is-visible="isCreateCollectionVisible"
      @update:is-visible="isCreateCollectionVisible = $event"
      @created="onCollectionCreated"
    />
  </div>
</template>
