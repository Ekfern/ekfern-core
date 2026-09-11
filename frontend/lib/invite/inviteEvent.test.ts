import { describe, it, expect } from 'vitest'
import { eventFromInvitePayload } from './inviteEvent'

/**
 * The regression these guard: the wire says `event_timezone`, the client reads
 * `timezone`, and a raw spread satisfies the type checker while dropping the
 * field entirely. Both render paths go through this mapper now, so the rename
 * is asserted once instead of being re-derived in each of them.
 */
describe('eventFromInvitePayload', () => {
  const payload = {
    id: 7,
    title: 'Meera & Arjun',
    slug: 'meera-arjun',
    event: 42, // the FK integer, not an object
    event_timezone: 'America/Chicago',
    event_country: 'US',
    background_url: 'https://cdn.example/bg.jpg',
    config: { tiles: [] },
    has_rsvp: true,
    catalog_title: 'Our registry',
  }

  it('carries the timezone across the name change', () => {
    expect(eventFromInvitePayload(payload).timezone).toBe('America/Chicago')
  })

  it('carries the country across the name change', () => {
    expect(eventFromInvitePayload(payload).country).toBe('US')
  })

  it('maps config and background to the names the renderer reads', () => {
    const event = eventFromInvitePayload(payload)
    expect(event.page_config).toEqual({ tiles: [] })
    expect(event.banner_image).toBe('https://cdn.example/bg.jpg')
  })

  it('keeps the rest of the payload rather than allow-listing it', () => {
    const event = eventFromInvitePayload(payload) as Record<string, any>
    expect(event.has_rsvp).toBe(true)
    expect(event.catalog_title).toBe('Our registry')
    expect(event.slug).toBe('meera-arjun')
  })

  it('leaves timezone undefined when the payload has none, rather than defaulting', () => {
    // A default here is what hid the original bug: every guest outside India
    // was confidently told IST.
    const event = eventFromInvitePayload({ id: 1, title: 'x' })
    expect(event.timezone).toBeUndefined()
  })

  it('accepts an already-canonical object without clobbering it', () => {
    const event = eventFromInvitePayload({ id: 1, title: 'x', timezone: 'Asia/Kolkata' })
    expect(event.timezone).toBe('Asia/Kolkata')
  })

  it('fills the defaults the server render used to apply inline', () => {
    const event = eventFromInvitePayload({})
    expect(event.id).toBe(0)
    expect(event.title).toBe('Event')
  })
})
