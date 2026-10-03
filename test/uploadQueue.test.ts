import { describe, expect, it } from 'vitest'
import { describeQueue, type UploadQueueSnapshot } from '~/utils/uploadQueue'

function snapshot(over: Partial<UploadQueueSnapshot> = {}): UploadQueueSnapshot {
  return { total: 0, active: 0, waiting: 0, capacity: 1, by_kind: {}, ...over }
}

describe('describeQueue', () => {
  it('hides itself when there is nothing queued and nothing staged', () => {
    // No wait to explain and no decision to inform — a row saying "0" is noise.
    expect(describeQueue(snapshot(), 0, 0).visible).toBe(false)
  })

  it('stays hidden until the first poll lands', () => {
    // Files are staged, but with no snapshot there is nothing truthful to say
    // about the wait yet.
    expect(describeQueue(null, 10, 0).visible).toBe(false)
  })

  it('reassures rather than warns when the encoder is free', () => {
    const q = describeQueue(snapshot(), 10, 0)
    expect(q.visible).toBe(true)
    expect(q.isBusy).toBe(false)
    expect(q.others).toBe(0)
  })

  it('describes the scenario the feature exists for', () => {
    // 20 of someone else's gifs already going, this uploader stages 10.
    const q = describeQueue(
      snapshot({ total: 20, active: 1, waiting: 19, by_kind: { gif: 20 } }),
      10,
      0,
    )
    expect(q.isBusy).toBe(true)
    expect(q.total).toBe(20)
    expect(q.others).toBe(20)
    expect(q.stagedLabel).toBe('10 staged files')
    expect(q.breakdown).toBe('20 gifs')
    expect(q.capacityLabel).toBe('one at a time')
  })

  it('does not count the uploader as waiting behind their own items', () => {
    // 30 in the queue, 10 of them this uploader's own batch: they are waiting
    // behind 20, not 30. Getting this wrong is invisible and wrong in exactly
    // the case that matters — a big batch of your own.
    const q = describeQueue(snapshot({ total: 30, active: 1, waiting: 29 }), 0, 10)
    expect(q.mine).toBe(10)
    expect(q.others).toBe(20)
  })

  it('clamps a stale own-count to the reported total', () => {
    // The two numbers are separate requests: the page can still believe 10 of
    // its records are processing after the queue has drained. Reporting
    // others = -8 would render as nonsense.
    const q = describeQueue(snapshot({ total: 2, active: 1, waiting: 1 }), 0, 10)
    expect(q.mine).toBe(2)
    expect(q.others).toBe(0)
  })

  it('never derives a negative count from an inconsistent snapshot', () => {
    const q = describeQueue(snapshot({ total: -5, active: -1 }), 0, -3)
    expect(q.total).toBe(0)
    expect(q.active).toBe(0)
    expect(q.mine).toBe(0)
    expect(q.others).toBe(0)
  })

  it('orders the breakdown by size and pluralises each bucket', () => {
    const q = describeQueue(
      snapshot({ total: 32, by_kind: { video: 2, gif: 28, sticker: 1, image: 1 } }),
      0,
      0,
    )
    // Biggest first; a 2-video wait is longer than a 28-pic one, so the reader
    // needs to see the composition, not just the total.
    expect(q.breakdown).toBe('28 gifs · 2 videos · 1 sticker · 1 pic')
  })

  it('names non-upload encoder work for what it is', () => {
    // /api/convert and the Discord bot's reuploads hold the same slot without
    // being anyone's upload.
    const q = describeQueue(snapshot({ total: 1, by_kind: { convert: 1 } }), 0, 0)
    expect(q.breakdown).toBe('1 conversion')
  })

  it('falls back to a neutral noun for an unrecognised bucket', () => {
    // The backend buckets unknown filetypes under "other"; a bucket added there
    // later must not render as `undefined`.
    const q = describeQueue(snapshot({ total: 3, by_kind: { future_kind: 3 } }), 0, 0)
    expect(q.breakdown).toBe('3 items')
  })

  it('omits empty buckets even if the backend sends them', () => {
    const q = describeQueue(snapshot({ total: 1, by_kind: { gif: 1, video: 0 } }), 0, 0)
    expect(q.breakdown).toBe('1 gif')
  })

  it('reports a parallel encoder honestly', () => {
    // MAX_PROCESS_JOBS is deployment config, so "one at a time" must not be
    // hardcoded into the copy.
    expect(describeQueue(snapshot({ total: 5, capacity: 4 }), 0, 0).capacityLabel).toBe(
      '4 at a time',
    )
  })

  it('uses the singular for one staged file', () => {
    expect(describeQueue(snapshot({ total: 1 }), 1, 0).stagedLabel).toBe('1 staged file')
  })
})
