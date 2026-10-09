/**
 * A repeating series as hosts choose it (backend/apps/events/recurrence.py),
 * and the words guests read for it.
 */

export type RepeatFreq = 'weekly' | 'fortnightly' | 'monthly'

export interface RecurrenceSpec {
  freq: RepeatFreq
  /** 0 = Monday ... 6 = Sunday, as Python counts them. Weekly and fortnightly only. */
  weekdays: number[]
  /** Last date of the series (ISO), or null while it has no end. */
  until: string | null
  /** ISO dates the host skipped. */
  skipped: string[]
}

const DAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const ORDINALS: Record<string, string> = { '1': '1st', '2': '2nd', '3': '3rd', '4': '4th', '-1': 'Last' }

/** Monday-first weekday of a plain ISO date, without the reader's zone shifting it. */
export function weekdayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

/** "2nd" / "Last": which of its weekday in the month a date is, as the backend repeats it. */
export function nthOfMonth(isoDate: string): string {
  const day = Number(isoDate.split('-')[2])
  const n = Math.floor((day - 1) / 7) + 1
  return n >= 5 ? 'Last' : ORDINALS[String(n)]
}

function joinDays(days: number[], names: string[]): string {
  const list = [...new Set(days)].sort((a, b) => a - b).map((d) => names[d])
  return list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} & ${list[list.length - 1]}`
}

/**
 * The rhythm, as people say it.
 *
 *   FREQ=WEEKLY;BYDAY=SU             "Every Sunday"
 *   FREQ=WEEKLY;INTERVAL=2;BYDAY=SU  "Every other Sunday"
 *   FREQ=WEEKLY;BYDAY=MO,WE          "Every Mon & Wed"
 *   FREQ=MONTHLY;BYDAY=-1FR          "Last Friday of each month"
 */
export function rhythmLabel(rrule: string | null | undefined): string {
  if (!rrule) return ''
  const fields = Object.fromEntries(
    rrule.toUpperCase().split(';').filter((p) => p.includes('=')).map((p) => p.split('=') as [string, string]),
  )
  const byday = (fields.BYDAY || '').split(',').filter(Boolean)
  if (fields.FREQ === 'MONTHLY') {
    const match = /^(-?\d)([A-Z]{2})$/.exec(byday[0] || '')
    if (!match) return 'Monthly'
    return `${ORDINALS[match[1]] ?? ''} ${WEEKDAY_NAMES[DAY_CODES.indexOf(match[2])]} of each month`.trim()
  }
  const days = byday.map((code) => DAY_CODES.indexOf(code)).filter((d) => d >= 0)
  const every = fields.INTERVAL === '2' ? 'Every other' : 'Every'
  if (days.length === 0) return fields.INTERVAL === '2' ? 'Every 2 weeks' : 'Weekly'
  return `${every} ${joinDays(days, days.length > 1 ? WEEKDAY_SHORT : WEEKDAY_NAMES)}`
}

/**
 * The host's choice in one line, for the form's collapsed row:
 * "Every Saturday until 27 Dec · 1 date skipped".
 */
export function specSummary(spec: RecurrenceSpec | null | undefined, firstDate?: string): string {
  if (!spec) return 'Doesn’t repeat'
  let rhythm: string
  if (spec.freq === 'monthly') {
    rhythm = firstDate ? `${nthOfMonth(firstDate)} ${WEEKDAY_NAMES[weekdayOf(firstDate)]} of each month` : 'Monthly'
  } else {
    const days = spec.weekdays.length ? spec.weekdays : firstDate ? [weekdayOf(firstDate)] : []
    const every = spec.freq === 'fortnightly' ? 'Every other' : 'Every'
    rhythm = days.length ? `${every} ${joinDays(days, days.length > 1 ? WEEKDAY_SHORT : WEEKDAY_NAMES)}` : 'Weekly'
  }
  const until = spec.until ? ` until ${dayMonth(spec.until)}` : ''
  const skipped = spec.skipped.length ? ` · ${spec.skipped.length} date${spec.skipped.length > 1 ? 's' : ''} skipped` : ''
  return `${rhythm}${until}${skipped}`
}

function dayMonth(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(Date.UTC(y, m - 1, d)))
}
