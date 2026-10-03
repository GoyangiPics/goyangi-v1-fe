/**
 * `imgur` is a site upload whose file came from an imgur link through the
 * upload page's import — a recovered file, not one of the uploader's own, and
 * the backend stamps it from `mirror`. Discord-ingested imgur links are still
 * `discord`: the bot is the provenance there.
 */
export type ContentOrigin = 'direct' | 'discord' | 'imgur'

/** The subset of a record this helper reads. */
interface OriginSource {
  origin?: string
  discord?: string
}

/**
 * Where a record came from, or null when it can't be known.
 *
 * Prefers the explicit `origin` field, falling back to `discord` for rows that
 * predate the backfill — a non-empty jump link means the bot ingested it, which is
 * the same test the backend uses in bot/autopost.go.
 *
 * ## What this replaced, and why it was wrong
 *
 * The old test was `!content.mirror`. But `mirror` is only set for imgur links
 * (or an explicit `mirror:` metadata line), so a Discord *attachment*, a catbox
 * link and a pixeldrain link all have an empty `mirror` — and every one of them
 * was rendering as a direct site upload.
 *
 * ## Why the `typeof` check, rather than checking truthiness
 *
 * PocketBase returns every declared field, using the empty string for unset. So
 * `discord` is always a string on a `contents` record and always `undefined` on a
 * set or collection, which makes this a reliable "is this a content record?"
 * test. That matters because it lets the chip stop keying off `simpleDate`, a
 * presentation flag that was being used as a type tag — and once `origin` is
 * backfilled onto sets, they get provenance for free.
 */
export function contentOrigin(record: OriginSource | null | undefined): ContentOrigin | null {
  if (!record) return null

  const origin = record.origin?.trim()
  if (origin === 'direct' || origin === 'discord' || origin === 'imgur') return origin

  if (typeof record.discord === 'string') {
    return record.discord.trim() ? 'discord' : 'direct'
  }

  return null
}
