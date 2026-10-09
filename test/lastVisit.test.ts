import { describe, expect, it } from 'vitest'
import { isNewSince, parsePbTime } from '~/utils/lastVisit'

describe('parsePbTime', () => {
  it('reads PocketBase timestamps, space separator and all', () => {
    expect(parsePbTime('2026-10-08 12:00:00.000Z')).toBe(Date.UTC(2026, 9, 8, 12))
    expect(parsePbTime('2026-10-08T12:00:00.000Z')).toBe(Date.UTC(2026, 9, 8, 12))
  })

  it('is NaN for nothing or junk', () => {
    expect(parsePbTime('')).toBeNaN()
    expect(parsePbTime(undefined)).toBeNaN()
    expect(parsePbTime('soon')).toBeNaN()
  })
})

describe('isNewSince', () => {
  const since = Date.UTC(2026, 9, 8, 12)

  it('marks only what came after the baseline', () => {
    expect(isNewSince('2026-10-08 12:00:01.000Z', since)).toBe(true)
    expect(isNewSince('2026-10-08 12:00:00.000Z', since)).toBe(false)
    expect(isNewSince('2026-10-01 09:00:00.000Z', since)).toBe(false)
  })

  // A first visit has nothing to compare against: everything would be "new",
  // which says nothing.
  it('marks nothing without a baseline or a timestamp', () => {
    expect(isNewSince('2026-10-08 13:00:00.000Z', null)).toBe(false)
    expect(isNewSince(undefined, since)).toBe(false)
  })
})
