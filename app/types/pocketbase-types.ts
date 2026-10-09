/**
* This file was @generated using pocketbase-typegen
*/

import type PocketBase from 'pocketbase'
import type { RecordService } from 'pocketbase'

export const Collections = {
	Authorigins: "_authOrigins",
	Externalauths: "_externalAuths",
	Mfas: "_mfas",
	Otps: "_otps",
	Superusers: "_superusers",
	Contents: "contents",
	ContentsCollections: "contents_collections",
	ContentsLabels: "contents_labels",
	ContentsReports: "contents_reports",
	ContentsSets: "contents_sets",
	Groups: "groups",
	GroupsIdols: "groups_idols",
	Labels: "labels",
	LabelsStats: "labels_stats",
	SystemLogs: "system_logs",
	Tags: "tags",
	Uploaders: "uploaders",
	UploadersStats: "uploaders_stats",
	Users: "users",
	UsersFilters: "users_filters",
	UsersLikes: "users_likes",
	UsersLinks: "users_links",
	UsersStars: "users_stars",
} as const
export type Collections = typeof Collections[keyof typeof Collections]

// Alias types for improved usability
export type IsoDateString = string
export type IsoAutoDateString = string & { readonly autodate: unique symbol }
export type RecordIdString = string
export type FileNameString = string & { readonly filename: unique symbol }
export type HTMLString = string

type ExpandType<T> = unknown extends T
	? T extends unknown
		? { expand?: unknown }
		: { expand: T }
	: { expand: T }

// System fields
export type BaseSystemFields<T = unknown> = {
	id: RecordIdString
	collectionId: string
	collectionName: Collections
} & ExpandType<T>

export type AuthSystemFields<T = unknown> = {
	email: string
	emailVisibility: boolean
	username: string
	verified: boolean
} & BaseSystemFields<T>

// Record types for each collection

export type AuthoriginsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	fingerprint: string
	id: string
	recordRef: string
	updated: IsoAutoDateString
}

export type ExternalauthsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	provider: string
	providerId: string
	recordRef: string
	updated: IsoAutoDateString
}

export type MfasRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	method: string
	recordRef: string
	updated: IsoAutoDateString
}

export type OtpsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	password: string
	recordRef: string
	sentTo?: string
	updated: IsoAutoDateString
}

export type SuperusersRecord = {
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

export const ContentsFiletypeOptions = {
	"video": "video",
	"image": "image",
	"gif": "gif",
	"sticker": "sticker",
} as const
export type ContentsFiletypeOptions = typeof ContentsFiletypeOptions[keyof typeof ContentsFiletypeOptions]

export const ContentsOriginOptions = {
	"direct": "direct",
	"discord": "discord",
	"imgur": "imgur",
	"script": "script",
} as const
export type ContentsOriginOptions = typeof ContentsOriginOptions[keyof typeof ContentsOriginOptions]
export type ContentsRecord = {
	collections?: RecordIdString[]
	created: IsoAutoDateString
	date?: IsoDateString
	discord?: string
	encodeAttempts?: number
	encodeError?: string
	file?: FileNameString
	filename?: string
	filetype?: ContentsFiletypeOptions
	group: RecordIdString[]
	height?: number
	id: string
	idol: RecordIdString[]
	interpolate?: number
	interpolate_mode?: string
	labels?: RecordIdString[]
	likes?: RecordIdString[]
	mirror?: string
	origin?: ContentsOriginOptions
	original?: string
	preview?: string
	preview_format?: string
	sd?: string
	set?: RecordIdString
	source?: string
	static?: string
	tag?: RecordIdString[]
	title: string
	updated: IsoAutoDateString
	uploader?: RecordIdString
	views?: number
	width?: number
}

export type ContentsCollectionsRecord = {
	cover?: string
	created: IsoAutoDateString
	id: string
	isPublic?: boolean
	title?: string
	updated: IsoAutoDateString
	user?: RecordIdString[]
}

export type ContentsLabelsRecord = {
	content: RecordIdString
	created: IsoAutoDateString
	id: string
	label: RecordIdString
	updated: IsoAutoDateString
	user?: RecordIdString
}

export const ContentsReportsTypeOptions = {
	"tos": "tos",
	"tags": "tags",
	"quality": "quality",
	"other": "other",
} as const
export type ContentsReportsTypeOptions = typeof ContentsReportsTypeOptions[keyof typeof ContentsReportsTypeOptions]
export type ContentsReportsRecord = {
	content: RecordIdString
	created: IsoAutoDateString
	id: string
	message?: string
	type: ContentsReportsTypeOptions
	updated: IsoAutoDateString
	user: RecordIdString
}

export const ContentsSetsOriginOptions = {
	"direct": "direct",
	"discord": "discord",
	"imgur": "imgur",
	"script": "script",
} as const
export type ContentsSetsOriginOptions = typeof ContentsSetsOriginOptions[keyof typeof ContentsSetsOriginOptions]
export type ContentsSetsRecord = {
	created: IsoAutoDateString
	date?: IsoDateString
	group: RecordIdString[]
	id: string
	idol: RecordIdString[]
	origin?: ContentsSetsOriginOptions
	title?: string
	updated: IsoAutoDateString
	uploader?: RecordIdString[]
	views?: number
}

export type GroupsRecord = {
	aliases?: string
	code: string
	created: IsoAutoDateString
	id: string
	name: string
	updated: IsoAutoDateString
}

export type GroupsIdolsRecord = {
	aliases?: string
	code: string
	created: IsoAutoDateString
	group?: RecordIdString
	id: string
	name: string
	updated: IsoAutoDateString
}

export type LabelsRecord = {
	created: IsoAutoDateString
	id: string
	name: string
	slug: string
	updated: IsoAutoDateString
}

export type LabelsStatsRecord = {
	id: string
	name?: string
	slug?: string
	uses?: number
}

export const SystemLogsSourceOptions = {
	"discord_bot": "discord_bot",
	"direct_upload": "direct_upload",
} as const
export type SystemLogsSourceOptions = typeof SystemLogsSourceOptions[keyof typeof SystemLogsSourceOptions]

export const SystemLogsLevelOptions = {
	"error": "error",
	"warning": "warning",
} as const
export type SystemLogsLevelOptions = typeof SystemLogsLevelOptions[keyof typeof SystemLogsLevelOptions]
export type SystemLogsRecord<Tcontext = unknown> = {
	context?: null | Tcontext
	created: IsoAutoDateString
	id: string
	level: SystemLogsLevelOptions
	message: string
	source: SystemLogsSourceOptions
}

export type TagsRecord = {
	code: string
	created: IsoAutoDateString
	id: string
	name: string
	updated: IsoAutoDateString
}

export type UploadersRecord = {
	aliases?: string
	blockIngest?: boolean
	created: IsoAutoDateString
	id: string
	name?: string
	skipDiscordImport?: boolean
	updated: IsoAutoDateString
	user?: RecordIdString
}

export type UploadersStatsRecord = {
	aliases?: string
	created: IsoAutoDateString
	id: string
	name?: string
	uploads?: number
	user?: RecordIdString
}

export type UsersRecord = {
	avatar?: FileNameString
	canUpload?: boolean
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	isAdmin?: boolean
	name?: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

export type UsersFiltersRecord<Tfilters = unknown> = {
	created: IsoAutoDateString
	filters?: null | Tfilters
	id: string
	name?: string
	updated: IsoAutoDateString
	user?: RecordIdString
}

export type UsersLikesRecord = {
	content: RecordIdString
	created: IsoAutoDateString
	id: string
	updated: IsoAutoDateString
	user: RecordIdString
}

export type UsersLinksRecord<Tlinks = unknown> = {
	created: IsoAutoDateString
	id: string
	links?: null | Tlinks
	title?: string
	updated: IsoAutoDateString
	user?: RecordIdString
}

export type UsersStarsRecord = {
	created: IsoAutoDateString
	group?: RecordIdString
	id: string
	idol?: RecordIdString
	updated: IsoAutoDateString
	user: RecordIdString
}

// Response types include system fields and match responses from the PocketBase API
export type AuthoriginsResponse<Texpand = unknown> = Required<AuthoriginsRecord> & BaseSystemFields<Texpand>
export type ExternalauthsResponse<Texpand = unknown> = Required<ExternalauthsRecord> & BaseSystemFields<Texpand>
export type MfasResponse<Texpand = unknown> = Required<MfasRecord> & BaseSystemFields<Texpand>
export type OtpsResponse<Texpand = unknown> = Required<OtpsRecord> & BaseSystemFields<Texpand>
export type SuperusersResponse<Texpand = unknown> = Required<SuperusersRecord> & AuthSystemFields<Texpand>
export type ContentsResponse<Texpand = unknown> = Required<ContentsRecord> & BaseSystemFields<Texpand>
export type ContentsCollectionsResponse<Texpand = unknown> = Required<ContentsCollectionsRecord> & BaseSystemFields<Texpand>
export type ContentsLabelsResponse<Texpand = unknown> = Required<ContentsLabelsRecord> & BaseSystemFields<Texpand>
export type ContentsReportsResponse<Texpand = unknown> = Required<ContentsReportsRecord> & BaseSystemFields<Texpand>
export type ContentsSetsResponse<Texpand = unknown> = Required<ContentsSetsRecord> & BaseSystemFields<Texpand>
export type GroupsResponse<Texpand = unknown> = Required<GroupsRecord> & BaseSystemFields<Texpand>
export type GroupsIdolsResponse<Texpand = unknown> = Required<GroupsIdolsRecord> & BaseSystemFields<Texpand>
export type LabelsResponse<Texpand = unknown> = Required<LabelsRecord> & BaseSystemFields<Texpand>
export type LabelsStatsResponse<Texpand = unknown> = Required<LabelsStatsRecord> & BaseSystemFields<Texpand>
export type SystemLogsResponse<Tcontext = unknown, Texpand = unknown> = Required<SystemLogsRecord<Tcontext>> & BaseSystemFields<Texpand>
export type TagsResponse<Texpand = unknown> = Required<TagsRecord> & BaseSystemFields<Texpand>
export type UploadersResponse<Texpand = unknown> = Required<UploadersRecord> & BaseSystemFields<Texpand>
export type UploadersStatsResponse<Texpand = unknown> = Required<UploadersStatsRecord> & BaseSystemFields<Texpand>
export type UsersResponse<Texpand = unknown> = Required<UsersRecord> & AuthSystemFields<Texpand>
export type UsersFiltersResponse<Tfilters = unknown, Texpand = unknown> = Required<UsersFiltersRecord<Tfilters>> & BaseSystemFields<Texpand>
export type UsersLikesResponse<Texpand = unknown> = Required<UsersLikesRecord> & BaseSystemFields<Texpand>
export type UsersLinksResponse<Tlinks = unknown, Texpand = unknown> = Required<UsersLinksRecord<Tlinks>> & BaseSystemFields<Texpand>
export type UsersStarsResponse<Texpand = unknown> = Required<UsersStarsRecord> & BaseSystemFields<Texpand>

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	_authOrigins: AuthoriginsRecord
	_externalAuths: ExternalauthsRecord
	_mfas: MfasRecord
	_otps: OtpsRecord
	_superusers: SuperusersRecord
	contents: ContentsRecord
	contents_collections: ContentsCollectionsRecord
	contents_labels: ContentsLabelsRecord
	contents_reports: ContentsReportsRecord
	contents_sets: ContentsSetsRecord
	groups: GroupsRecord
	groups_idols: GroupsIdolsRecord
	labels: LabelsRecord
	labels_stats: LabelsStatsRecord
	system_logs: SystemLogsRecord
	tags: TagsRecord
	uploaders: UploadersRecord
	uploaders_stats: UploadersStatsRecord
	users: UsersRecord
	users_filters: UsersFiltersRecord
	users_likes: UsersLikesRecord
	users_links: UsersLinksRecord
	users_stars: UsersStarsRecord
}

export type CollectionResponses = {
	_authOrigins: AuthoriginsResponse
	_externalAuths: ExternalauthsResponse
	_mfas: MfasResponse
	_otps: OtpsResponse
	_superusers: SuperusersResponse
	contents: ContentsResponse
	contents_collections: ContentsCollectionsResponse
	contents_labels: ContentsLabelsResponse
	contents_reports: ContentsReportsResponse
	contents_sets: ContentsSetsResponse
	groups: GroupsResponse
	groups_idols: GroupsIdolsResponse
	labels: LabelsResponse
	labels_stats: LabelsStatsResponse
	system_logs: SystemLogsResponse
	tags: TagsResponse
	uploaders: UploadersResponse
	uploaders_stats: UploadersStatsResponse
	users: UsersResponse
	users_filters: UsersFiltersResponse
	users_likes: UsersLikesResponse
	users_links: UsersLinksResponse
	users_stars: UsersStarsResponse
}

// Utility types for create/update operations

type ProcessCreateAndUpdateFields<T> = Omit<{
	// Omit AutoDate fields
	[K in keyof T as Extract<T[K], IsoAutoDateString> extends never ? K : never]: 
		// Convert FileNameString to File
		T[K] extends infer U ? 
			U extends (FileNameString | FileNameString[]) ? 
				U extends any[] ? File[] : File 
			: U
		: never
}, 'id'>

// Create type for Auth collections
export type CreateAuth<T> = {
	id?: RecordIdString
	email: string
	emailVisibility?: boolean
	password: string
	passwordConfirm: string
	verified?: boolean
} & ProcessCreateAndUpdateFields<T>

// Create type for Base collections
export type CreateBase<T> = {
	id?: RecordIdString
} & ProcessCreateAndUpdateFields<T>

// Update type for Auth collections
export type UpdateAuth<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof AuthSystemFields>
> & {
	email?: string
	emailVisibility?: boolean
	oldPassword?: string
	password?: string
	passwordConfirm?: string
	verified?: boolean
}

// Update type for Base collections
export type UpdateBase<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof BaseSystemFields>
>

// Get the correct create type for any collection
export type Create<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? CreateAuth<CollectionRecords[T]>
		: CreateBase<CollectionRecords[T]>

// Get the correct update type for any collection
export type Update<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? UpdateAuth<CollectionRecords[T]>
		: UpdateBase<CollectionRecords[T]>

// Type for usage with type asserted PocketBase instance
// https://github.com/pocketbase/js-sdk#specify-typescript-definitions

export type TypedPocketBase = {
	collection<T extends keyof CollectionResponses>(
		idOrName: T
	): RecordService<CollectionResponses[T]>
} & PocketBase
