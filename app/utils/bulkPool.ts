/**
 * Runs `worker` over `items` with a bounded number in flight, retrying the
 * requests PocketBase rate-limits, and reports which items succeeded and which
 * failed — so a bulk action can say "12 done, 2 failed" and keep the failed ones
 * selected for a retry.
 *
 * A worker pool over a shared cursor rather than chunked batches: one slow
 * request in a chunk would idle the rest. Same shape as useLikeAll's.
 */
export interface PoolOptions {
  concurrency?: number
  /** Called after each item settles, with how many have settled so far. */
  onProgress?: (settled: number, total: number) => void
  /** Retries for a rate-limited (429) request. */
  retries?: number
  /** Overridable for tests. */
  sleep?: (ms: number) => Promise<void>
}

export interface PoolResult<T> {
  done: T[]
  failed: { item: T; error: unknown }[]
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function isRateLimited(error: unknown): boolean {
  return (error as { status?: number })?.status === 429
}

export async function runPool<T>(
  items: readonly T[],
  worker: (item: T) => Promise<unknown>,
  opts: PoolOptions = {},
): Promise<PoolResult<T>> {
  const concurrency = Math.max(1, opts.concurrency ?? 4)
  const retries = opts.retries ?? 3
  const sleep = opts.sleep ?? realSleep
  const result: PoolResult<T> = { done: [], failed: [] }
  let cursor = 0
  let settled = 0

  async function attempt(item: T) {
    for (let tries = 0; ; tries++) {
      try {
        await worker(item)
        return
      } catch (error) {
        if (!isRateLimited(error) || tries >= retries) throw error
        await sleep(500 * 2 ** tries)
      }
    }
  }

  async function lane() {
    while (cursor < items.length) {
      const item = items[cursor++] as T
      try {
        await attempt(item)
        result.done.push(item)
      } catch (error) {
        result.failed.push({ item, error })
      }
      settled++
      opts.onProgress?.(settled, items.length)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane))
  return result
}
