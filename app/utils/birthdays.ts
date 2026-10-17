/**
 * Birthdays are stored as PocketBase dates at midnight UTC
 * (`2004-08-31 00:00:00.000Z`), and only the calendar date means anything. So
 * they are read as text — never through `new Date()`, which would shift the day
 * for anyone west of UTC.
 */
interface BirthdayParts {
  year: number
  month: number // 1-12
  day: number
}

export function parseBirthday(value: string | null | undefined): BirthdayParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '')
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Whether a birthday falls on `today`, in the visitor's own calendar day — the
 * announcement is about the day they're having, not Seoul's.
 *
 * 29 February birthdays are celebrated on the 28th in other years, otherwise
 * they'd go three years in four without one.
 */
export function isBirthdayOn(birthday: string | null | undefined, today: Date): boolean {
  const parts = parseBirthday(birthday)
  if (!parts) return false
  const month = today.getMonth() + 1
  const day = today.getDate()
  if (parts.month === 2 && parts.day === 29 && !isLeapYear(today.getFullYear())) {
    return month === 2 && day === 28
  }
  return parts.month === month && parts.day === day
}

/** The visitor's calendar date as YYYY-MM-DD, for keying per-day state. */
export function localDateKey(today: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
}
