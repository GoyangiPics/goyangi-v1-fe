import { describe, expect, it } from 'vitest'
import { hasOwnDate } from '~/utils/formatDate'

describe('hasOwnDate', () => {
  // Every record has a date now (the backend fills an unset one with the upload
  // time), so "has one" can't be the test — "says something different" is.
  it('is false when the date lands on the upload day', () => {
    expect(
      hasOwnDate({ date: '2026-07-24 10:00:00.000Z', created: '2026-07-24 10:00:00.000Z' }),
    ).toBe(false)
    // A day-only date and a timestamp on the same day.
    const created = new Date(2026, 6, 24, 18, 30)
    const date = new Date(2026, 6, 24)
    expect(hasOwnDate({ date: date.toISOString(), created: created.toISOString() })).toBe(false)
  })

  it('is true when the date is a different day', () => {
    const created = new Date(2026, 6, 24, 18, 30)
    const date = new Date(2025, 11, 31)
    expect(hasOwnDate({ date: date.toISOString(), created: created.toISOString() })).toBe(true)
  })

  it('is false with no date and true with no upload time', () => {
    expect(hasOwnDate({ date: '', created: '2026-07-24 10:00:00.000Z' })).toBe(false)
    expect(hasOwnDate({ date: '2026-07-24 10:00:00.000Z' })).toBe(true)
  })
})
