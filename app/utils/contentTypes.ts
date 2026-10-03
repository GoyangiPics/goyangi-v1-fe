import type { FilterOption } from '~/types/typesFilters'

/**
 * The "Content type" filter's options. Values are `contents.filetype` values.
 *
 * "Gifs" used to point at `video` — the keep-the-audio, no-autoplay pipeline,
 * a small minority of the library — so the filter returned a handful of videos
 * and no gifs at all. Gifs are `gif`; videos get their own option now.
 * Stickers are deliberately absent: they are a pipeline, not something anyone
 * browses for.
 *
 * Multi-select: neither picked means all, and any combination is a union.
 */
export const contentTypes: FilterOption[] = [
  { option: 'Gifs', value: 'gif' },
  { option: 'Pics', value: 'image' },
  { option: 'Videos', value: 'video' },
]

/**
 * Re-resolve persisted options' labels from their values.
 *
 * Filters are stored whole — label and value — in localStorage and in saved
 * `users_filters` blobs. After the fix above, an old `{ Gifs, video }` entry
 * still means videos (the value is what the query uses) and should say so.
 * Unknown values pass through untouched so nothing is silently dropped.
 */
export function relabelFiletypes(list: FilterOption[] | undefined): FilterOption[] {
  return (list ?? []).map((f) => contentTypes.find((ct) => ct.value === f.value) ?? f)
}
