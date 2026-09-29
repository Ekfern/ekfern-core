/**
 * Rows for the Event Details tile's compact layout — small labels on the
 * left, details on the right. Pure so the "a row appears only when its field
 * is filled in" rule can be tested without rendering the tile.
 */

import type { EventDetailsTileSettings } from './schema'
import { formatEventTime } from './timezone'

export type CompactRow = { label: string; value: string }

/** "Sat, Oct 10, 2026". Date-only strings are read as local dates, like the other layouts. */
export function formatCompactDate(dateString: string): string {
  let date: Date
  if (dateString.includes('T')) {
    date = new Date(dateString)
  } else {
    const [year, month, day] = dateString.split('-').map(Number)
    if (!year || !month || !day) return dateString
    date = new Date(year, month - 1, day)
  }
  if (Number.isNaN(date.getTime())) return dateString
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * "10:00–11:00 AM EDT", or "11:30 AM–1:00 PM EDT" across noon. The zone is
 * printed once, at the end. Without a usable end time it is just the start.
 */
export function formatTimeRange(start: string, end?: string, timeZone?: string, on?: Date): string {
  const startLabel = formatEventTime(start, undefined, on)
  if (!end) return formatEventTime(start, timeZone, on)
  const endLabel = formatEventTime(end, timeZone, on)
  // formatEventTime hands back its input when it cannot parse it.
  if (endLabel === end || startLabel === start) return formatEventTime(start, timeZone, on)

  const startMeridiem = startLabel.slice(-2)
  const endMeridiem = endLabel.split(' ')[1]
  const startPart = startMeridiem === endMeridiem ? startLabel.slice(0, -3) : startLabel
  return `${startPart}–${endLabel}`
}

export function buildCompactRows(
  settings: Pick<EventDetailsTileSettings, 'date' | 'time' | 'endTime' | 'repeats' | 'location' | 'dressCode'>,
  timeZone?: string,
  on?: Date,
): CompactRow[] {
  const rows: CompactRow[] = []
  const repeats = settings.repeats?.trim()
  const time = settings.time ? formatTimeRange(settings.time, settings.endTime, timeZone, on) : ''
  const date = settings.date ? formatCompactDate(settings.date) : ''

  if (repeats) {
    // A repeating class: "When" carries the rhythm, the date is when it starts.
    rows.push({ label: 'When', value: [repeats, time].filter(Boolean).join(' · ') })
    if (date) rows.push({ label: 'Starts', value: date })
  } else {
    if (date) rows.push({ label: 'Date', value: date })
    if (time) rows.push({ label: 'Time', value: time })
  }
  const location = settings.location?.trim()
  if (location) rows.push({ label: 'Where', value: location })
  const dressCode = settings.dressCode?.trim()
  if (dressCode) rows.push({ label: 'Dress code', value: dressCode })
  return rows
}
