import type PocketBase from 'pocketbase'
import { describe, expect, it, vi } from 'vitest'
import { firstEmbeddableContent } from '~/utils/ogContent'

const READY = { id: 'ready', preview: 'https://cdn/a.avif', original: 'https://cdn/a.mp4' }
const ENCODING = { id: 'encoding', preview: '', original: '' }

/**
 * A fake pb whose getList answers per call, and records the filters it was
 * asked for — the filter is the whole mechanism here, so asserting on it is
 * asserting on the fix.
 */
function fakePb(pages: Array<Record<string, any>[]>) {
  const filters: string[] = []
  let call = 0
  const pb = {
    collection: () => ({
      getList: vi.fn(async (_page: number, _per: number, opts: { filter: string }) => {
        filters.push(opts.filter)
        return { items: pages[call++] ?? [] }
      }),
    }),
  } as unknown as PocketBase
  return { pb, filters, calls: () => call }
}

describe('firstEmbeddableContent', () => {
  it('asks for an item with a rendition first', async () => {
    const { pb, filters, calls } = fakePb([[READY]])

    const got = await firstEmbeddableContent(pb, 'set="s1"')

    expect(got).toBe(READY)
    // One query when something is ready — the fallback must not cost a round
    // trip in the common case.
    expect(calls()).toBe(1)
    expect(filters[0]).toContain('set="s1"')
    expect(filters[0]).toContain('preview != ""')
    expect(filters[0]).toContain('original != ""')
  })

  it('falls back to the newest item when nothing is ready yet', async () => {
    // A brand-new set whose first upload is still encoding: there is no
    // embeddable item to find, and the caller still wants the record for its
    // `source`.
    const { pb, filters, calls } = fakePb([[], [ENCODING]])

    const got = await firstEmbeddableContent(pb, 'set="s1"')

    expect(got).toBe(ENCODING)
    expect(calls()).toBe(2)
    // The fallback drops the rendition requirement but keeps the scope — it
    // must never reach outside the set.
    expect(filters[1]).toBe('set="s1"')
    expect(filters[1]).not.toContain('preview')
  })

  it('returns null for an empty set rather than throwing', async () => {
    const { pb } = fakePb([[], []])

    expect(await firstEmbeddableContent(pb, 'set="empty"')).toBeNull()
  })

  it('keeps the scope filter grouped, so an OR cannot escape it', async () => {
    // Without the parentheses, `a || b && c` would let an unrelated record with
    // a preview satisfy the query — the embed would then show content from
    // another set entirely.
    const { pb, filters } = fakePb([[READY]])

    await firstEmbeddableContent(pb, 'collections~"c1"')

    expect(filters[0]).toBe('(collections~"c1") && (preview != "" || original != "")')
  })
})
