/**
 * Calendar utilities for Google Calendar and ICS file generation
 */

import { BRAND_NAME } from '@/lib/brand_utility'

export interface CalendarEvent {
  title: string
  details?: string
  location?: string
  /**
   * Where the invitation lives. A guest who saved this three months ago has no
   * other route back to the RSVP, the venue or the aarti - the calendar entry
   * is the only thing they kept.
   */
  url?: string
  /**
   * Stable identity for this event, e.g. `meera-arjun@example.com`.
   *
   * Calendars key on UID: the same one twice is one event updated, a new one
   * each time is a second event. This was generated from `Date.now()` and a
   * random suffix, so a guest who tapped Download twice - or came back after
   * the host moved the ceremony - collected duplicates rather than a
   * correction. Falls back to a random UID when the caller has no stable
   * identity to offer.
   */
  uid?: string
  /**
   * Bumped whenever the event's details change. A calendar that already holds
   * this UID uses it to tell a newer copy from the one it has.
   */
  sequence?: number
  startISO: string
  endISO: string
  /**
   * A repeating series. Its times are then written on the event's own clock
   * (TZID), not in UTC: "every Saturday at 7 pm" must stay Saturday at the
   * venue even when the UTC date is Friday.
   */
  series?: {
    rrule: string
    /** ISO dates with no gathering. */
    skipped?: string[]
    timeZone: string
  }
}

/** `YYYYMMDDTHHmmss` on a zone's wall clock - what TZID-qualified times are written in. */
export function localStamp(iso: string, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  )
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`
}

/**
 * The stored rule, as calendars want it: UNTIL becomes the end of that day in
 * UTC, which is the form RFC 5545 requires next to a TZID start.
 */
function calendarRrule(rrule: string): string {
  return rrule
    .split(';')
    .map((part) => (/^UNTIL=\d{8}$/i.test(part) ? `${part}T235959Z` : part))
    .join(';')
}

/**
 * The body of the entry: whatever the host wrote, then the link.
 *
 * Shared by both exports so Google and .ics show a guest the same thing.
 */
function buildDescription(event: CalendarEvent): string {
  return [event.details, event.url].filter(Boolean).join('\n\n')
}

/**
 * Generate Google Calendar URL
 */
export function getGoogleCalendarHref(event: CalendarEvent): string {
  const series = event.series
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    // A series is written on the venue's clock and Google told which one.
    dates: series
      ? `${localStamp(event.startISO, series.timeZone)}/${localStamp(event.endISO, series.timeZone)}`
      : `${formatGoogleDate(event.startISO)}/${formatGoogleDate(event.endISO)}`,
  })
  if (series) {
    params.append('ctz', series.timeZone)
    params.append('recur', `RRULE:${calendarRrule(series.rrule)}`)
  }

  const details = buildDescription(event)
  if (details) {
    params.append('details', details)
  }

  if (event.location) {
    params.append('location', event.location)
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Format date for Google Calendar (YYYYMMDDTHHmmssZ)
 */
function formatGoogleDate(isoString: string): string {
  const date = new Date(isoString)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

/**
 * RFC 5545 §3.1: no content line may exceed 75 octets.
 *
 * Longer ones are folded - split across lines, each continuation starting with
 * a single space that the reader strips again. Nothing here folded before,
 * which went unnoticed while the only long line was a SUMMARY. A URL on a real
 * domain with a real slug clears 75 comfortably.
 *
 * Counted in octets, not characters, and split on code points so a multi-byte
 * character is never cut in half. `TextEncoder` rather than `Buffer` because
 * this module is imported by client components too.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line

  const folded: string[] = []
  let current = ''
  let octets = 0

  for (const char of line) {
    const size = encoder.encode(char).length
    if (octets + size > 75) {
      folded.push(current)
      // The leading space is part of the continuation line's 75.
      current = ` ${char}`
      octets = 1 + size
    } else {
      current += char
      octets += size
    }
  }
  folded.push(current)

  return folded.join('\r\n')
}

/**
 * Generate ICS file content
 */
export function generateICS(event: CalendarEvent): string {
  const startDate = formatICSDate(event.startISO)
  const endDate = formatICSDate(event.endISO)
  const now = formatICSDate(new Date().toISOString())

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${BRAND_NAME}//Invitation//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid || generateUID()}`,
    `DTSTAMP:${now}`,
  ]

  const series = event.series
  if (series) {
    const zone = series.timeZone
    const startLocal = localStamp(event.startISO, zone)
    lines.push(
      `DTSTART;TZID=${zone}:${startLocal}`,
      `DTEND;TZID=${zone}:${localStamp(event.endISO, zone)}`,
      `RRULE:${calendarRrule(series.rrule)}`,
    )
    // A skipped date is that day at the series' own start time.
    const time = startLocal.slice(8)
    for (const day of series.skipped ?? []) {
      lines.push(`EXDATE;TZID=${zone}:${day.replace(/-/g, '')}${time}`)
    }
  } else {
    lines.push(`DTSTART:${startDate}`, `DTEND:${endDate}`)
  }
  lines.push(`SUMMARY:${escapeICS(event.title)}`)

  const description = buildDescription(event)
  if (description) {
    lines.push(`DESCRIPTION:${escapeICS(description)}`)
  }

  // A URI value, not text - escaping its commas would corrupt the link. Sent
  // alongside DESCRIPTION because plenty of clients never surface URL.
  if (event.url) {
    lines.push(`URL:${event.url}`)
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeICS(event.location)}`)
  }

  lines.push(
    'STATUS:CONFIRMED',
    `SEQUENCE:${Number.isFinite(event.sequence) ? Math.max(0, Math.trunc(event.sequence as number)) : 0}`,
    'END:VEVENT',
    'END:VCALENDAR',
  )

  return lines.map(foldLine).join('\r\n')
}

/**
 * Format date for ICS (YYYYMMDDTHHmmssZ)
 */
function formatICSDate(isoString: string): string {
  const date = new Date(isoString)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

/**
 * Escape special characters for ICS format
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/**
 * Last-resort identity, for callers with nothing stable to key on.
 *
 * Random, so every call is a distinct event to a calendar. Prefer passing
 * `uid`.
 */
function generateUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@event-registry`
}

