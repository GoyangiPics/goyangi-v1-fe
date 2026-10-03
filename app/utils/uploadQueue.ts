/**
 * Turning the backend's encode-queue counters into the sentence an uploader
 * needs: "your 10 staged files start after the 28 ahead of them".
 *
 * Pure, and split out of UploadQueueStatus.vue for the same reason uploadPlan
 * was split out of uploads.vue: the arithmetic is the part that can be quietly
 * wrong. Counting an uploader's own in-flight items as things they're waiting
 * behind is invisible in a screenshot and wrong in exactly the case the feature
 * exists for — a big batch of your own.
 *
 * Nothing here touches Vue or PocketBase, so it runs under plain vitest.
 */

/** Body of `GET /api/queue`. See hooks/queue_api.go in the backend. */
export interface UploadQueueSnapshot {
  /** Waiting plus active — the number an uploader thinks of as "the queue". */
  total: number
  /** Encoding right now. Never more than `capacity`. */
  active: number
  waiting: number
  /** How many jobs the backend runs at once. 1 on the current deployment. */
  capacity: number
  /** Non-empty buckets only, e.g. `{ gif: 28, video: 2 }`. */
  by_kind: Record<string, number>
}

/**
 * Singular/plural per bucket.
 *
 * "pics" rather than "images" because that's what the type tab is labelled.
 * `convert` covers /api/convert calls and the Discord bot's reuploads, which
 * hold the same encoder slot without being an upload — counted, but not named as
 * if they were someone's files.
 */
const kindNames: Record<string, [string, string]> = {
  gif: ['gif', 'gifs'],
  video: ['video', 'videos'],
  image: ['pic', 'pics'],
  sticker: ['sticker', 'stickers'],
  convert: ['conversion', 'conversions'],
  other: ['item', 'items'],
}

export interface QueueDescription {
  /** False when there's neither a wait to explain nor a decision to inform. */
  visible: boolean
  /** Something is queued — drives the amber vs neutral treatment. */
  isBusy: boolean
  total: number
  active: number
  /** This uploader's own items in the queue. */
  mine: number
  /** Everyone else's — what a staged batch would actually wait behind. */
  others: number
  capacityLabel: string
  /** `"28 gifs · 2 videos"`, biggest bucket first. Empty when unknown. */
  breakdown: string
  stagedLabel: string
}

/**
 * @param snapshot   Latest poll, or null before the first one lands.
 * @param stagedCount Files picked but not yet uploaded.
 * @param mineInQueue This uploader's own items already in the queue. Comes from
 *   the page's own per-record polls, so it is approximate — it is clamped to
 *   `total` rather than trusted, because the two numbers are separate requests
 *   and a finished item can leave `total` before the page notices.
 */
export function describeQueue(
  snapshot: UploadQueueSnapshot | null,
  stagedCount: number,
  mineInQueue: number,
): QueueDescription {
  const total = Math.max(0, snapshot?.total ?? 0)
  const mine = Math.min(Math.max(0, mineInQueue), total)

  return {
    visible: !!snapshot && (total > 0 || stagedCount > 0),
    isBusy: total > 0,
    total,
    active: Math.max(0, snapshot?.active ?? 0),
    mine,
    others: total - mine,
    capacityLabel:
      (snapshot?.capacity ?? 1) === 1 ? 'one at a time' : `${snapshot!.capacity} at a time`,
    breakdown: formatBreakdown(snapshot?.by_kind),
    stagedLabel: stagedCount === 1 ? '1 staged file' : `${stagedCount} staged files`,
  }
}

function formatBreakdown(byKind: Record<string, number> | undefined): string {
  if (!byKind) return ''
  return (
    Object.entries(byKind)
      .filter(([, count]) => count > 0)
      // Biggest bucket first — there is one line of room, so the long pole is the
      // part worth reading. A queue of 2 videos is a longer wait than 28 pics.
      .toSorted((a, b) => b[1] - a[1])
      .map(([kind, count]) => {
        const [one, many] = kindNames[kind] ?? kindNames.other!
        return `${count} ${count === 1 ? one : many}`
      })
      .join(' · ')
  )
}
