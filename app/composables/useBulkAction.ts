import type { PoolResult } from '~/utils/bulkPool'
import { runPool } from '~/utils/bulkPool'

export interface BulkActionOptions<T> {
  items: readonly T[]
  action: (item: T) => Promise<unknown>
  /** Progress toast title, e.g. "Deleting posts…". */
  progress: string
  /** Success toast title for n items, e.g. n => `Deleted ${n} posts`. */
  success: (n: number) => string
  /** Title when nothing succeeded, e.g. "Couldn't delete posts". */
  failure: string
  /** Lower for heavy writes — a set delete cascades and holds the write lock. */
  concurrency?: number
}

/**
 * A bulk write with one progress toast that turns into the summary.
 *
 * Plain record calls, one per item, so the API rules and hooks judge each one
 * exactly as they would a single action — no bulk route to keep in step.
 */
export function useBulkAction() {
  const toast = useToast()

  async function run<T>(opts: BulkActionOptions<T>): Promise<PoolResult<T>> {
    const total = opts.items.length
    // duration: 0 on every update — Nuxt UI resets the timer from the toast's
    // own value otherwise (see useLikeAll).
    const progress = toast.add({
      title: opts.progress,
      description: `0/${total}`,
      color: 'info',
      duration: 0,
    })

    const result = await runPool(opts.items, opts.action, {
      concurrency: opts.concurrency,
      onProgress: (settled) =>
        toast.update(progress.id, { description: `${settled}/${total}`, duration: 0 }),
    })

    const done = result.done.length
    const failed = result.failed.length
    if (failed) console.error('Bulk action failures:', result.failed)
    toast.update(progress.id, {
      title: done === 0 && failed > 0 ? opts.failure : opts.success(done),
      description: failed
        ? `${failed} failed. They're still selected so you can try again.`
        : undefined,
      color: failed ? (done ? 'warning' : 'error') : 'success',
      duration: failed ? 5000 : 2500,
    })
    return result
  }

  return { run }
}
