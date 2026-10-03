import type { Group, Idol, Tag, Uploader } from '~/types/appTypes'

export interface FilterOption {
  value: string
  option: string
}

/**
 * A label in filter state.
 *
 * Carries `slug` because that is what both the filter clause and the URL use, so
 * a label restored from `?label=cute` needs no lookup to be usable. `name` is
 * for chip display and `id` is optional precisely because a URL-restored label
 * has none until `hydrateLabelNames` fills it in.
 */
export interface LabelRef {
  id?: string
  name: string
  slug: string
}

export interface Filters {
  idol: Idol[]
  group: Group[]
  uploader: Uploader[]
  filetype: FilterOption[]
  tag: Tag[]
  /**
   * Direct vs Discord provenance. An ARRAY rather than a scalar tri-state so it
   * behaves like every other field: `isFilterSet` only counts array-valued keys,
   * `buildClause` already handles option-style items, and serialization mirrors
   * `filetype`. "All" is naturally "neither selected".
   */
  origin: FilterOption[]
  label: LabelRef[]
  date: (Date | null)[]
  dateMode: FilterOption | null
  sort: FilterOption | null
}

export enum MostLikedModes {
  AllTime = 'alltime',
  OneYear = '1year',
  SixMonths = '6months',
  ThreeMonths = '3months',
  OneMonth = '1month',
  OneWeek = '1week',
}

export type { Group, Idol, SavedFilter, Tag, Uploader } from '~/types/appTypes'
