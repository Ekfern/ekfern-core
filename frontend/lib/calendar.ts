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
  startISO: string
  endISO: string
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
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatGoogleDate(event.startISO)}/${formatGoogleDate(event.endISO)}`,
  })

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
    `UID:${generateUID()}`,
    `DTSTAMP:${now}`,
    `DTSTART:${startDate}`,
    `DTEND:${endDate}`,
    `SUMMARY:${escapeICS(event.title)}`,
  ]

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

  lines.push('STATUS:CONFIRMED', 'SEQUENCE:0', 'END:VEVENT', 'END:VCALENDAR')

  return lines.join('\r\n')
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
 * Generate unique ID for ICS event
 */
function generateUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@event-registry`
}

