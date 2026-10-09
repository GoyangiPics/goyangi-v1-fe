import type { Group, Idol, Tag } from '~/types/appTypes'
import { inferGroups } from '~/utils/inferGroups'

/**
 * The pure half of the upload page: turning batch settings plus per-file
 * overrides into the exact record each file will become.
 *
 * Extracted from uploads.vue because that page had no test coverage at all and
 * the FormData construction — a dozen conditional appends, several of them
 * sticker-only — is the part most likely to break silently. A wrong append
 * writes a bad record; a missing one fails a schema-required field at the API.
 *
 * Nothing here touches Vue, PocketBase or auto-imports, so it runs under plain
 * vitest (see vitest.config.ts on why that matters).
 */

/** Batch-level values every file starts from. */
export interface BatchDefaults {
  idol: Idol[]
  tag: Tag[]
  title: string
  date: Date | null
}

/**
 * Per-file deviations from the batch.
 *
 * An absent key inherits. A present key is honoured literally — including an
 * empty array, which means "this file genuinely has none" and is left for
 * validation to reject rather than silently re-inheriting the batch value.
 * `date: null` likewise means cleared, not absent, which is why the resolver
 * tests `!== undefined` rather than using `??`.
 */
export interface FileOverride {
  idol?: Idol[]
  tag?: Tag[]
  title?: string
  date?: Date | null
}

/** One file's fully resolved metadata. */
export interface ResolvedMeta {
  idol: Idol[]
  group: Group[]
  tag: Tag[]
  title: string
  date: Date | null
}

/** Everything about the upload that isn't per-file metadata. */
export interface UploadContext {
  filetype: string
  isSticker: boolean
  source: string
  uploaderId?: string
  /** Gif uploads only; the backend defaults to AVIF when absent. */
  previewFormat?: string
  setId?: string | null
  collectionIds?: string[]
}

/** `YYYY-MM-DD` in LOCAL time — `toISOString()` would shift the day near midnight. */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** `YYMMDD`, the prefix set titles carry. Local time, same reason as above. */
export function formatYYMMDD(date: Date): string {
  const y = String(date.getFullYear()).slice(-2)
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/** `"Yujin, Wonyoung - IVE"` — the stem both generated titles are built from. */
export function buildContentTitle(
  idols: Array<{ name?: string }>,
  groups: Array<{ name?: string }>,
): string {
  const idolNames = idols
    .map((i) => i.name)
    .filter(Boolean)
    .join(', ')
  const groupNames = groups
    .map((g) => g.name)
    .filter(Boolean)
    .join(', ')
  if (idolNames && groupNames) return `${idolNames} - ${groupNames}`
  return idolNames || groupNames || ''
}

/** `clip.final.mp4` -> `clip.final`. Last dot only, and never eats a path separator. */
export function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, '')
}

/**
 * The title a file will be saved with.
 *
 * `title` is schema-required, so this must never return an empty string. The
 * filename fallback exists because the previous chain ended at the literal
 * placeholder `'Title...'`, which was unreachable only while batch idols were
 * unconditionally required — relaxing that made it persistable.
 *
 * An explicitly typed batch title beats a generated per-file one: typing a title
 * is a deliberate statement about the whole batch.
 */
export function resolveTitle(
  overrideTitle: string | undefined,
  batchTitle: string,
  idols: Array<{ name?: string }>,
  groups: Array<{ name?: string }>,
  fileName: string,
): string {
  const own = overrideTitle?.trim()
  if (own) return own

  const batch = batchTitle.trim()
  if (batch) return batch

  const generated = buildContentTitle(idols, groups)
  if (generated) return generated

  return stripExtension(fileName).trim() || 'Untitled'
}

/** Batch defaults plus this file's overrides, with group derived from the result. */
export function resolveFileMeta(
  defaults: BatchDefaults,
  override: FileOverride | undefined,
  allGroups: Group[],
  fileName = '',
): ResolvedMeta {
  const idol = override?.idol ?? defaults.idol
  const tag = override?.tag ?? defaults.tag
  const date = override?.date !== undefined ? override.date : defaults.date
  // Never overridable: group is always what the resolved idols imply, so the
  // two can't disagree. See inferGroups.
  const group = inferGroups(idol, allGroups)

  return {
    idol,
    group,
    tag,
    date,
    title: resolveTitle(override?.title, defaults.title, idol, group, fileName),
  }
}

/**
 * The multipart body for one content record.
 *
 * Relations are repeated keys rather than a joined string — that is how
 * PocketBase reads a multi-relation from multipart.
 */
/**
 * @param mirror The imgur link a file was imported from, when it was. `mirror`
 * is the field that already exists for exactly this (bot/links.go sets it for
 * imgur links it ingests), so a link-imported record is indistinguishable from
 * a bot-ingested one rather than looking like a native upload with no source.
 */
export function buildFormData(
  file: File,
  meta: ResolvedMeta,
  ctx: UploadContext,
  mirror?: string,
): FormData {
  const formData = new FormData()

  formData.append('file', file)
  // The name the file arrived with. PocketBase renames on save and the encode
  // hook deletes the source, so without this the name was gone for good.
  formData.append('filename', file.name)
  formData.append('title', meta.title)
  formData.append('source', ctx.source)
  formData.append('filetype', ctx.filetype)

  meta.idol.forEach((idol) => formData.append('idol', idol.id))
  meta.group.forEach((group) => formData.append('group', group.id))

  // Stickers carry neither tags nor a date — their pipeline ignores both.
  if (!ctx.isSticker) {
    meta.tag.forEach((tag) => formData.append('tag', tag.id))
    formData.append('date', toLocalDateString(meta.date ?? new Date()))
  }

  if (ctx.uploaderId) formData.append('uploader', ctx.uploaderId)

  if (ctx.previewFormat) formData.append('preview_format', ctx.previewFormat)

  // No `interpolate` / `interpolate_mode`: the RIFE pipeline exists on the
  // backend but is unfinished, so nothing in the UI can set them. The fields
  // stay on the record; this just stops the upload path pretending to write them.

  if (mirror) formData.append('mirror', mirror)

  if (ctx.setId) formData.append('set', ctx.setId)
  ctx.collectionIds?.forEach((id) => formData.append('collections', id))

  return formData
}

// ─── Validation ──────────────────────────────────────────────────────────────

export interface UploadLimits {
  label: string
  maxFiles: number
  maxFileSizeMB: number
  maxTotalSizeMB: number
}

/** One staged file with its overrides already applied. */
export interface ResolvedFile extends ResolvedMeta {
  key: string
  name: string
}

export interface ValidationInput {
  files: File[]
  limits: UploadLimits
  batchIdols: Idol[]
  isSticker: boolean
  title: string
  source: string
  /** True when the destination is a collection, which then has to be chosen. */
  requiresCollection?: boolean
  collectionIds?: string[]
  /**
   * Every staged file, resolved. When present, idols are checked per file and
   * the batch picker stops being required — which is the whole point of per-file
   * metadata: 50 unrelated gifs shouldn't force a meaningless union at batch
   * level just to pass validation.
   */
  resolvedFiles?: ResolvedFile[]
}

/** "a.gif, b.gif and 3 more" — bounded so an error stays readable at 50 files. */
function nameList(names: string[], max = 3): string {
  if (names.length <= max) return names.join(', ')
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`
}

/** Keyed so the banner can list one line per class of problem. */
export type ValidationErrors = Record<string, string>

export function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Per-file problems, keyed by fileKey, so a row or tile can mark itself.
 *
 * The banner says how many and which; this says which control to look at.
 */
export function computeFileErrors(resolved: ResolvedFile[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const file of resolved) {
    const messages: string[] = []
    if (file.idol.length === 0) messages.push('Needs an idol.')
    else if (file.group.length === 0) messages.push('This idol has no group.')
    if (messages.length) out[file.key] = messages
  }
  return out
}

/**
 * Every idol and group across the batch, de-duplicated and order-preserved.
 *
 * A set's own idol/group used to come from the batch picker, which per-file
 * overrides can now contradict — the set would list fewer idols than its
 * children carry, and grouped idol filtering reads the SET's fields. Building it
 * from the union keeps the two in step.
 */
export function unionRelations(resolved: ResolvedFile[]): { idol: Idol[]; group: Group[] } {
  const idol = new Map<string, Idol>()
  const group = new Map<string, Group>()
  for (const file of resolved) {
    for (const i of file.idol) if (!idol.has(i.id)) idol.set(i.id, i)
    for (const g of file.group) if (!group.has(g.id)) group.set(g.id, g)
  }
  return { idol: [...idol.values()], group: [...group.values()] }
}

export function computeUploadErrors(input: ValidationInput): ValidationErrors {
  const e: ValidationErrors = {}
  const { files, limits } = input

  if (!files || files.length === 0) {
    e.files = 'Add at least one file.'
  } else if (files.length > limits.maxFiles) {
    e.files = `You can upload up to ${limits.maxFiles} file${limits.maxFiles === 1 ? '' : 's'} here.`
  } else {
    const oversized = files.find((f) => f.size > limits.maxFileSizeMB * 1024 * 1024)
    if (oversized) {
      e.files = `"${oversized.name}" is over the ${limits.maxFileSizeMB}MB limit.`
    } else {
      const totalMB = files.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024)
      if (totalMB > limits.maxTotalSizeMB) {
        e.files = `Total size ${totalMB.toFixed(0)}MB is over the ${limits.maxTotalSizeMB}MB limit.`
      }
    }
  }

  const resolved = input.resolvedFiles
  if (resolved?.length) {
    const noIdol = resolved.filter((f) => f.idol.length === 0)
    // group is derived from idol, so a file with idols but no groups means an
    // idol record has no group — schema-required on contents, and it used to
    // surface as a raw PocketBase 400 instead.
    const noGroup = resolved.filter((f) => f.idol.length > 0 && f.group.length === 0)

    if (noIdol.length === resolved.length) {
      // Nothing anywhere has an idol, so the batch picker is the thing to fix.
      e.idol = 'Select at least one idol.'
    } else if (noIdol.length > 0) {
      e.idol = `No idol for ${nameList(noIdol.map((f) => f.name))}.`
    }

    if (noGroup.length > 0) {
      e.group = `Idol with no group in ${nameList(noGroup.map((f) => f.name))}.`
    }
  } else if (input.batchIdols.length === 0) {
    e.idol = 'Select at least one idol.'
  }

  if (input.requiresCollection && !input.collectionIds?.length) {
    e.collection = 'Pick a collection.'
  }

  if (input.isSticker && !input.title.trim()) e.title = 'Stickers need a title.'

  const src = input.source.trim()
  if (src && !isValidUrl(src)) {
    e.source = 'Source must start with http:// or https://.'
  }

  return e
}

/** The three upload tabs. Pics and gifs share one — see hintFiletype. */
export type UploadTab = 'media' | 'video' | 'sticker'
/** The `contents.filetype` values a web upload can end up with. */
export type Filetype = 'image' | 'gif' | 'video' | 'sticker'

/**
 * The filetype HINT sent with a file. A hint, because the server decides:
 * the create hook counts frames and corrects `image`/`gif` from the bytes,
 * which is the only way to tell an animated WebP or AVIF from a still one.
 *
 * So this only has to be right for the unambiguous cases — a video container
 * is an animation, an image mime is a still — and the reclassification catches
 * the rest. It exists at all so the results panel can show sensible links
 * while the record is still encoding, and so the queue bucket starts right.
 *
 * `video` and `sticker` are tabs the person chose deliberately (keep the
 * audio, don't autoplay; square-crop) and pass straight through.
 */
export function hintFiletype(name: string, mime: string, tab: UploadTab): Filetype {
  if (tab !== 'media') return tab
  if (mime.startsWith('video/') || /\.(mp4|webm|mkv|mov)$/i.test(name)) return 'gif'
  return 'image'
}
