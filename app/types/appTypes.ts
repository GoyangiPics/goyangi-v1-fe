import type {
  ContentsCollectionsResponse,
  ContentsLabelsResponse,
  ContentsResponse,
  ContentsSetsResponse,
  GroupsIdolsResponse,
  GroupsResponse,
  LabelsResponse,
  LabelsStatsResponse,
  TagsResponse,
  UploadersResponse,
  UploadersStatsResponse,
  UsersFiltersResponse,
  UsersLikesResponse,
  UsersResponse,
} from '~/types/pocketbase-types'

export interface ContentsExpand {
  idol?: GroupsIdolsResponse[]
  group?: GroupsResponse[]
  tag?: TagsResponse[]
  /**
   * The denormalised read cache the backend hook maintains from
   * `contents_labels`. Read from here; write through useLabels.
   */
  labels?: LabelsResponse[]
  uploader?: UploadersResponse
  likes?: UsersLikesResponse[]
  set?: ContentsSetsResponse
}

/** A `contents_labels` join row with its label (and applier) expanded. */
export interface LabelJoinExpand {
  label?: LabelsResponse
}

export type LabelJoin = ContentsLabelsResponse<LabelJoinExpand>

export type ContentsItem = ContentsResponse<ContentsExpand>
export type CollectionsItem = ContentsCollectionsResponse
export type SetsItem = ContentsSetsResponse

export interface SetsUnifiedExpand {
  idol?: GroupsIdolsResponse[]
  group?: GroupsResponse[]
  uploader?: UploadersResponse[]
  contents_via_set?: ContentsResponse<ContentsExpand>[]
}

export type SetsUnifiedItem = ContentsSetsResponse<SetsUnifiedExpand>

/**
 * A row of the `uploaders_stats` view collection: an uploader's public fields
 * plus a maintained `uploads` count, so /uploaders is one request rather than
 * one count query per profile. `user` expands like it does on `uploaders`.
 */
export type UploaderStat = UploadersStatsResponse<{ user?: UsersResponse }>

export type {
  GroupsResponse as Group,
  GroupsIdolsResponse as Idol,
  LabelsResponse as Label,
  // The `labels_stats` view collection — same fields plus a maintained `uses`
  // count, so the browse page needs no per-label count query.
  LabelsStatsResponse as LabelStat,
  UsersLikesResponse as Like,
  UsersFiltersResponse as SavedFilter,
  TagsResponse as Tag,
  UploadersResponse as Uploader,
}
