import { NextRequest, NextResponse } from 'next/server'
import { generateICS } from '@/lib/calendar'
import { zonedTimeToUtc } from '@/lib/invite/timezone'
import { getSiteUrl } from '@/lib/site-url'
import type { EventDetailsTileSettings, InviteConfig, Tile } from '@/lib/invite/schema'

// Get API base URL for server-side fetching
// In Docker, use BACKEND_API_BASE (service name), otherwise use NEXT_PUBLIC_API_BASE
const API_BASE = process.env.BACKEND_API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

/** No end time exists on the tile yet, so assume four hours. */
const DEFAULT_DURATION_MS = 4 * 60 * 60 * 1000

/**
 * When the event starts, taken from the tile the invitation actually renders.
 *
 * This used to read `event.date` off the payload, a field the public invite
 * serializer does not return - so the route answered 404 for every invitation.
 * The date and time live in the event-details tile inside `config`, which is
 * also where the page reads them, so the calendar entry and the printed time
 * cannot disagree.
 */
function findEventDetails(config: InviteConfig | undefined): EventDetailsTileSettings | null {
  const tiles: Tile[] = config?.tiles ?? []
  const tile = tiles.find((t) => t.type === 'event-details' && t.enabled !== false)
  return tile ? (tile.settings as EventDetailsTileSettings) : null
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const slug = searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ error: 'Slug parameter is required' }, { status: 400 })
  }

  try {
    // Fetch event data from API
    const response = await fetch(`${API_BASE}/api/events/invite/${slug}/`, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const payload = await response.json()

    // An unpublished invite answers 200 with a placeholder rather than a 404.
    if (!payload || payload.status === 'coming_soon') {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const details = findEventDetails(payload.config)
    const date = details?.date
    const timeZone: string | undefined = payload.event_timezone

    if (!date) {
      return NextResponse.json({ error: 'Event has no date set' }, { status: 404 })
    }
    if (!timeZone) {
      return NextResponse.json({ error: 'Event has no timezone set' }, { status: 404 })
    }

    // The host typed a wall clock at the venue; a calendar needs the moment it
    // refers to. Resolving that against the event's zone - not this server's,
    // and not the guest's - is what lets a Mumbai guest's calendar show 7:00 AM
    // for a 7:30 PM Chicago wedding.
    const startDate = zonedTimeToUtc(date, details?.time, timeZone)
    if (!startDate) {
      return NextResponse.json({ error: 'Event date could not be resolved' }, { status: 404 })
    }

    const endDate = new Date(startDate.getTime() + DEFAULT_DURATION_MS)

    const siteUrl = getSiteUrl()
    // Keyed on the slug, which is what makes this invitation *this* invitation,
    // so a guest who downloads twice ends up with one entry rather than two.
    const uidHost = (() => {
      try {
        return new URL(siteUrl).host
      } catch {
        return 'invite'
      }
    })()
    // Minutes since the epoch at the invite's last edit: monotonic, comfortably
    // inside the 32-bit range calendars expect, and it moves whenever the host
    // republishes - which is exactly when a held copy has gone stale.
    const updatedMs = Date.parse(payload.updated_at ?? '')
    const sequence = Number.isFinite(updatedMs) ? Math.floor(updatedMs / 60000) : 0

    // Generate ICS content
    const icsContent = generateICS({
      title: payload.title || 'Event',
      location: details?.location || undefined,
      // No guest token: a downloaded .ics gets forwarded, and one guest's
      // personal link should not travel with it.
      url: `${siteUrl}/invite/${slug}`,
      uid: `${slug}@${uidHost}`,
      sequence,
      startISO: startDate.toISOString(),
      endISO: endDate.toISOString(),
    })

    // Return ICS file
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slug}-event.ics"`,
      },
    })
  } catch (error: any) {
    console.error('Failed to generate ICS:', error)
    return NextResponse.json({ error: 'Failed to generate calendar file' }, { status: 500 })
  }
}
