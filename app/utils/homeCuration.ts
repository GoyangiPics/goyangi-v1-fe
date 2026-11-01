import type { Tag } from '~/types/appTypes'
import { combinePbFilters, pbQuote } from '~/utils/filtersFilter'

/**
 * Filter building blocks for the trial home pages (/home1 … /home5).
 *
 * The full feed mixes site uploads with everything the Discord bot ingests, and
 * the ingested side is mostly fancams of mixed quality. These pages are the
 * curated front door, so they read site uploads only and leave the rest to the
 * full feed at `/`.
 */

/** Site uploads: direct, or recovered from imgur through the upload page. */
export const CURATED_ORIGIN = '(origin="direct"||origin="imgur")'

/** Tags that never appear on a home page. */
export const HIDDEN_TAG_NAMES = ['spicy']

/** Lower-cased, with a trailing plural `s` dropped, so "Emotes" finds "emote". */
function tagKey(name: string): string {
  return name.trim().toLowerCase().replace(/s$/, '')
}

/** The tag called `name`, ignoring case and a plural `s`. */
export function findTag(tags: Tag[], name: string): Tag | undefined {
  const key = tagKey(name)
  return tags.find((t) => tagKey(t.name) === key)
}

/**
 * Posts carrying any of `tags`.
 *
 * `~` against the relation's stored id list, the same idiom the collection page
 * uses for `collections~`. Null when no tag resolved, so a topic whose tag
 * doesn't exist yet shows nothing rather than everything.
 */
export function anyTagClause(tags: Array<Tag | undefined>): string | null {
  const ids = tags.filter((t): t is Tag => !!t).map((t) => `tag~${pbQuote(t.id)}`)
  return ids.length > 0 ? `(${ids.join('||')})` : null
}

/** Posts carrying none of the hidden tags. Untagged posts pass. */
export function hiddenTagsClause(tags: Tag[]): string {
  return combinePbFilters(
    ...HIDDEN_TAG_NAMES.map((name) => findTag(tags, name))
      .filter((t): t is Tag => !!t)
      .map((t) => `tag!~${pbQuote(t.id)}`),
  )
}

/** The starred-idols scope /me/feed uses, or null when nothing is starred. */
export function starredClause(idolIds: string[], groupIds: string[]): string | null {
  const parts = [
    ...idolIds.map((id) => `idol.id?=${pbQuote(id)}`),
    ...groupIds.map((id) => `group.id?=${pbQuote(id)}`),
  ]
  return parts.length > 0 ? `(${parts.join('||')})` : null
}

/**
 * `created` on or after `days` days before `now`.
 *
 * PocketBase compares `created` as text in its own `Y-m-d H:i:s` layout, so the
 * ISO `T` has to go — the same conversion the home page's "new since" count does.
 */
export function createdSince(days: number, now = Date.now()): string {
  const since = new Date(now - days * 86_400_000).toISOString().replace('T', ' ')
  return `created>=${pbQuote(since)}`
}

export interface Tally {
  id: string
  name: string
  count: number
}

/**
 * Count how often each related record appears across `items`, most frequent
 * first, ties by name. For the "trending groups" and "top uploaders" lists,
 * which have no server-side aggregate to ask.
 */
export function tally<T>(
  items: T[],
  pick: (item: T) => Array<{ id: string; name: string } | null | undefined>,
): Tally[] {
  const counts = new Map<string, Tally>()
  for (const item of items) {
    const seen = new Set<string>()
    for (const rel of pick(item)) {
      if (!rel?.id || seen.has(rel.id)) continue
      seen.add(rel.id)
      const entry = counts.get(rel.id)
      if (entry) entry.count++
      else counts.set(rel.id, { id: rel.id, name: rel.name, count: 1 })
    }
  }
  return [...counts.values()].toSorted((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** A kind of post the home pages give a row, chip or tile to. */
export interface HomeTopic {
  key: string
  label: string
  /** Tag names, any of which qualifies. Absent for a filetype-only topic. */
  tags?: string[]
  /** Defaults to gifs: the home pages are gif-first. */
  filetype?: 'gif' | 'video' | 'image'
  icon: string
}

export const HOME_TOPICS: HomeTopic[] = [
  { key: 'cute', label: 'Cute', tags: ['cute'], icon: 'i-lucide-heart' },
  { key: 'emotes', label: 'Emotes', tags: ['emote'], icon: 'i-lucide-smile' },
  { key: 'vlogs', label: 'Vlogs', tags: ['vlog'], icon: 'i-lucide-camera' },
  { key: 'live', label: 'Live', tags: ['live'], icon: 'i-lucide-radio' },
  { key: 'fancams', label: 'Fancams', tags: ['fancam'], icon: 'i-lucide-sparkles' },
  { key: 'edits', label: 'Edits', tags: ['edit'], icon: 'i-lucide-scissors' },
  { key: 'videos', label: 'Videos', filetype: 'video', icon: 'i-lucide-clapperboard' },
  { key: 'photos', label: 'Photos', filetype: 'image', icon: 'i-lucide-image' },
]

export function homeTopic(key: string): HomeTopic {
  const topic = HOME_TOPICS.find((t) => t.key === key)
  if (!topic) throw new Error(`Unknown home topic: ${key}`)
  return topic
}

/** Curated posts of one filetype, without the hidden tags. */
export function curatedFilter(
  tags: Tag[],
  filetype: HomeTopic['filetype'] | null = 'gif',
  ...extra: Array<string | null | undefined>
): string {
  return combinePbFilters(
    CURATED_ORIGIN,
    filetype ? `filetype=${pbQuote(filetype)}` : 'filetype!="sticker"',
    hiddenTagsClause(tags),
    ...extra,
  )
}

/**
 * A topic's filter, or null when it names tags and none of them exist — so a
 * row for a missing tag stays empty instead of showing every gif.
 */
export function topicFilter(topic: HomeTopic, tags: Tag[], ...extra: string[]): string | null {
  let tagClause: string | null = null
  if (topic.tags) {
    tagClause = anyTagClause(topic.tags.map((name) => findTag(tags, name)))
    if (!tagClause) return null
  }
  return curatedFilter(tags, topic.filetype ?? 'gif', tagClause, ...extra)
}

/** The full feed's query for a topic: its tag and filetype, site uploads only. */
export function topicFeedQuery(topic: HomeTopic, tags: Tag[]): Record<string, string> {
  const query: Record<string, string> = {
    filetype: topic.filetype ?? 'gif',
    origin: 'direct,imgur',
  }
  const tagNames = (topic.tags ?? [])
    .map((name) => findTag(tags, name)?.name)
    .filter((n): n is string => !!n)
  if (tagNames.length) query.tag = tagNames.join(',')
  return query
}
