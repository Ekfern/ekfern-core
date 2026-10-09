/**
 * Where an event is in its life, as the backend works it out
 * (backend/apps/events/lifecycle.py), and the words every surface uses for it.
 *
 * One vocabulary, so the invite, RSVP page, catalog and host screens never
 * disagree. Nobody is ever shown "expired", "archived" or "host catalog".
 */

import { getTimezoneLabel } from './timezone'

export type LifecyclePhase = 'upcoming' | 'happening' | 'ongoing' | 'ended' | 'cancelled' | 'archived'

export interface LifecycleSeries {
  rrule: string
  skipped: string[]
  /** ISO date of the next gathering, today included. */
  next_date: string | null
  today: boolean
}

export interface Lifecycle {
  phase: LifecyclePhase
  timezone: string
  ends_at: string | null
  rsvp_open: boolean
  catalog_open: boolean
  catalog_closes_at: string | null
  catalog_closed_early: boolean
  link_off_at: string | null
  cancelled_note: string
  series: LifecycleSeries | null
  /** On the cached invite payload only: when this copy stops being true. */
  valid_until?: string | null
}

/** What the backend refuses with, on RSVP or gift submit. */
export type LifecycleRefusal = 'RSVP_CLOSED' | 'CATALOG_CLOSED' | 'EVENT_CANCELLED' | 'EVENT_ARCHIVED'

export function lifecycleRefusal(error: unknown): { code: LifecycleRefusal; lifecycle?: Lifecycle } | null {
  const data = (error as { response?: { data?: { code?: string; lifecycle?: Lifecycle } } })?.response?.data
  const code = data?.code
  if (code === 'RSVP_CLOSED' || code === 'CATALOG_CLOSED' || code === 'EVENT_CANCELLED' || code === 'EVENT_ARCHIVED') {
    return { code, lifecycle: data?.lifecycle }
  }
  return null
}

export const GUEST_COPY = {
  ended: 'This celebration has ended',
  seriesEnded: 'This series has ended',
  cancelled: 'This event has been cancelled',
  happening: 'Happening today',
  rsvpClosed: 'RSVPs are closed',
  rsvpClosedShort: 'RSVPs closed',
  giftsClosed: 'Gifting has closed',
  archivedTitle: 'This invitation is no longer available',
  archivedBody: 'The host’s invitation has closed. If you were invited, the host can share the details with you.',
} as const

/** The slim line shown on the invitation itself, or null when there is nothing to say. */
export function guestRibbon(lifecycle: Lifecycle | null | undefined): { text: string; note?: string } | null {
  if (!lifecycle) return null
  if (lifecycle.phase === 'cancelled') {
    return { text: GUEST_COPY.cancelled, note: lifecycle.cancelled_note || undefined }
  }
  if (lifecycle.phase === 'ended') {
    return { text: lifecycle.series ? GUEST_COPY.seriesEnded : GUEST_COPY.ended }
  }
  return null
}

function dateParts(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone, weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(iso))
}

function clock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone, hour: 'numeric', minute: '2-digit',
  }).format(new Date(iso)).replace(' ', ' ').toLowerCase()
}

/**
 * A closing moment as people read it. The backend's moments are the start of
 * the next day, so a guest is told the last minute it is still open, in the
 * event's zone - and in their own as well when that differs.
 *
 *   "Sat 7 Dec, 11:59 pm IST"
 *   "Sat 7 Dec, 11:59 pm IST (1:29 pm your time)"
 */
export function closingLabel(iso: string | null | undefined, eventZone: string, guestZone?: string): string {
  if (!iso) return ''
  const lastOpen = new Date(new Date(iso).getTime() - 60_000).toISOString()
  const zone = eventZone || 'UTC'
  const label = `${dateParts(lastOpen, zone)}, ${clock(lastOpen, zone)} ${getTimezoneLabel(zone, new Date(lastOpen))}`
  if (!guestZone || guestZone === zone || sameOffset(lastOpen, zone, guestZone)) return label
  return `${label} (${clock(lastOpen, guestZone)} your time)`
}

function sameOffset(iso: string, a: string, b: string): boolean {
  const at = (zone: string) =>
    new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: 'numeric', day: 'numeric' }).format(new Date(iso))
  try {
    return at(a) === at(b)
  } catch {
    return true
  }
}

/** "Sun 12 Oct" - a series' next gathering, a plain date in the event's calendar. */
export function nextDateLabel(isoDate: string | null | undefined): string {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}
