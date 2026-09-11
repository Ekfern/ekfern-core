/**
 * What an event looks like to the invitation, and how the wire becomes it.
 *
 * The public invite endpoint returns an InvitePage, not an Event. It spells
 * several fields differently - `event_timezone`, `event_country`, `config` -
 * and its `event` key is the foreign key integer, not an object. So the payload
 * has to be mapped before anything renders from it.
 *
 * It was mapped in one place and spread raw in the other. The server render
 * built a real Event and set `timezone` from `event_timezone`; the client
 * refetch did `{ ...inviteData }`, which produces an object typed Event that
 * has no `timezone` at all. TypeScript could not see the difference because
 * both files declared their own `Event` interface, so the shapes were only ever
 * compared structurally and never against the wire.
 *
 * The visible result: every invitation rendered correctly for one paint, then
 * the client fetch landed and the event-details tile fell back to the platform
 * default. A Chicago wedding told its guests it started at 7:30 PM IST.
 *
 * One type and one mapper, used by both paths, so that stops being possible.
 */

import type { InviteConfig } from './schema'
import type { CatalogPurpose } from '@/lib/catalog/types'

export interface InviteEvent {
  id: number
  title: string
  date?: string
  description?: string
  banner_image?: string
  page_config?: InviteConfig
  has_rsvp?: boolean
  has_registry?: boolean
  catalog_show_on_event_page?: boolean
  catalog_show_on_rsvp_confirmation?: boolean
  catalog_title?: string
  catalog_purpose?: CatalogPurpose
  show_branding?: boolean
  country?: string
  /** IANA name, e.g. `America/Chicago`. Absent is meaningful - see below. */
  timezone?: string
  rsvp_count?: number
}

/**
 * The public invite payload as an event.
 *
 * Spreads first so nothing on the wire is lost, then fixes the names the wire
 * and the client disagree about. `timezone` is left undefined when the payload
 * carries none: a tile that knows it has no zone can decline to print one,
 * which is the honest outcome. Substituting a plausible default here is what
 * made the original bug invisible.
 */
export function eventFromInvitePayload(payload: Record<string, any>): InviteEvent {
  return {
    ...payload,
    id: payload.id || 0,
    title: payload.title || 'Event',
    banner_image: payload.background_url,
    page_config: payload.config,
    country: payload.event_country ?? payload.country,
    timezone: payload.event_timezone ?? payload.timezone,
  } as InviteEvent
}
