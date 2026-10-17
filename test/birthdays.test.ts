import { describe, expect, it } from 'vite-plus/test'
import { isBirthdayOn, localDateKey, parseBirthday } from '~/utils/birthdays'

// Local-time constructors throughout: the comparison is against the visitor's
// calendar day, whatever timezone the test runs in.
const on = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12)

describe('parseBirthday', () => {
  it('reads the calendar date off a PocketBase date', () => {
    expect(parseBirthday('2004-08-31 00:00:00.000Z')).toEqual({ year: 2004, month: 8, day: 31 })
  })

  it('is null for nothing or junk', () => {
    expect(parseBirthday('')).toBeNull()
    expect(parseBirthday(undefined)).toBeNull()
    expect(parseBirthday('2004-13-01 00:00:00.000Z')).toBeNull()
  })
})

describe('isBirthdayOn', () => {
  it('matches month and day, any year', () => {
    expect(isBirthdayOn('2004-08-31 00:00:00.000Z', on(2026, 8, 31))).toBe(true)
    expect(isBirthdayOn('2004-08-31 00:00:00.000Z', on(2026, 9, 1))).toBe(false)
    expect(isBirthdayOn('2004-08-31 00:00:00.000Z', on(2026, 7, 31))).toBe(false)
  })

  // Read as text, so midnight UTC can't slide to the 30th west of Greenwich.
  it('does not shift the day by timezone', () => {
    expect(isBirthdayOn('2004-08-31 00:00:00.000Z', on(2026, 8, 30))).toBe(false)
  })

  it('celebrates 29 February on the 28th outside leap years', () => {
    expect(isBirthdayOn('2000-02-29 00:00:00.000Z', on(2026, 2, 28))).toBe(true)
    expect(isBirthdayOn('2000-02-29 00:00:00.000Z', on(2028, 2, 28))).toBe(false)
    expect(isBirthdayOn('2000-02-29 00:00:00.000Z', on(2028, 2, 29))).toBe(true)
  })

  it('is false without a birthday', () => {
    expect(isBirthdayOn('', on(2026, 1, 1))).toBe(false)
  })
})

describe('localDateKey', () => {
  it('zero-pads the local date', () => {
    expect(localDateKey(on(2026, 3, 7))).toBe('2026-03-07')
  })
})
