import { describe, expect, it } from 'vite-plus/test'
import { runPool } from '~/utils/bulkPool'

const noSleep = async () => {}

describe('runPool', () => {
  it('runs every item and reports progress', async () => {
    const seen: number[] = []
    const progress: number[] = []
    const result = await runPool([1, 2, 3, 4, 5], async (n) => void seen.push(n), {
      concurrency: 2,
      onProgress: (settled) => progress.push(settled),
    })
    expect(result.done.toSorted()).toEqual([1, 2, 3, 4, 5])
    expect(result.failed).toEqual([])
    expect(progress).toEqual([1, 2, 3, 4, 5])
  })

  it('never has more than `concurrency` in flight', async () => {
    let inFlight = 0
    let peak = 0
    await runPool(
      Array.from({ length: 10 }, (_, i) => i),
      async () => {
        inFlight++
        peak = Math.max(peak, inFlight)
        await new Promise((r) => setTimeout(r, 1))
        inFlight--
      },
      { concurrency: 3 },
    )
    expect(peak).toBe(3)
  })

  it('keeps going past failures and reports them', async () => {
    const result = await runPool(
      ['a', 'b', 'c'],
      async (x) => {
        if (x === 'b') throw Object.assign(new Error('nope'), { status: 403 })
      },
      { sleep: noSleep },
    )
    expect(result.done).toEqual(['a', 'c'])
    expect(result.failed.map((f) => f.item)).toEqual(['b'])
  })

  it('retries rate-limited requests, then gives up', async () => {
    let calls = 0
    const flaky = await runPool(
      ['x'],
      async () => {
        if (++calls < 3) throw { status: 429 }
      },
      { sleep: noSleep },
    )
    expect(flaky.done).toEqual(['x'])

    let tries = 0
    const stuck = await runPool(
      ['y'],
      async () => {
        tries++
        throw { status: 429 }
      },
      { sleep: noSleep, retries: 2 },
    )
    expect(stuck.failed).toHaveLength(1)
    expect(tries).toBe(3)
  })
})
