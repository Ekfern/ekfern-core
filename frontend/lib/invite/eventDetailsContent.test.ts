import { describe, expect, it } from 'vitest'
import { changedContent, readEventDetailsContent, withEventDetailsContent } from './eventDetailsContent'
import type { InviteConfig } from './schema'

const dress = { id: 'd', kind: 'dress' as const, text: 'Pastels' }

const invitation = {
  tiles: [
    { id: 't', type: 'title', enabled: true, order: 0, settings: { text: 'Riya & Kabir' } },
    {
      id: 'e',
      type: 'event-details',
      enabled: true,
      order: 1,
      settings: { date: '2026-12-12', time: '19:00', location: 'The Lakeside Lawns, Udaipur', borderStyle: 'glass', goodToKnow: [dress] },
    },
  ],
} as InviteConfig

const details = (config: InviteConfig | null) =>
  config!.tiles!.find((t) => t.type === 'event-details')!.settings as unknown as Record<string, unknown>

describe('readEventDetailsContent', () => {
  it('reads what the invitation says', () => {
    expect(readEventDetailsContent(invitation)).toEqual({
      time: '19:00',
      location: 'The Lakeside Lawns, Udaipur',
      goodToKnow: [dress],
    })
  })

  it('reads an event without an invitation as empty', () => {
    expect(readEventDetailsContent(null)).toEqual({ time: '', location: '', goodToKnow: [] })
  })
})

describe('changedContent', () => {
  const before = readEventDetailsContent(invitation)

  it('is empty when nothing changed', () => {
    expect(changedContent(before, { ...before, location: '  The Lakeside Lawns, Udaipur ' })).toEqual({})
  })

  it('holds only what changed', () => {
    expect(changedContent(before, { ...before, time: '20:00' })).toEqual({ time: '20:00' })
  })

  it('ignores Good to know answers left blank', () => {
    expect(changedContent(before, { ...before, goodToKnow: [dress, { id: 's', kind: 'stay', text: ' ' }] })).toEqual({})
  })
})

describe('withEventDetailsContent', () => {
  it('patches only the Event Details tile, keeping its look', () => {
    const next = withEventDetailsContent(invitation, { time: '20:00' }, 'Riya & Kabir')
    expect(details(next)).toMatchObject({ time: '20:00', location: 'The Lakeside Lawns, Udaipur', borderStyle: 'glass' })
    expect(next!.tiles![0]).toEqual(invitation.tiles![0])
  })

  it('removes a cleared time and an emptied Good to know', () => {
    const next = withEventDetailsContent(invitation, { time: '', goodToKnow: [] }, 'x')
    expect(details(next)).not.toHaveProperty('time')
    expect(details(next)).not.toHaveProperty('goodToKnow')
  })

  it('writes nothing for an empty patch', () => {
    expect(withEventDetailsContent(invitation, {}, 'x')).toBeNull()
  })

  it('starts an invitation for an event that has none yet', () => {
    const next = withEventDetailsContent({}, { date: '2026-12-12', goodToKnow: [dress] }, 'Riya & Kabir')
    expect(next!.tiles!.map((t) => t.type)).toEqual(['title', 'event-details'])
    expect(details(next)).toMatchObject({ date: '2026-12-12', goodToKnow: [dress] })
  })

  it('does not start an invitation just for a date', () => {
    expect(withEventDetailsContent({}, { date: '2026-12-12' }, 'x')).toBeNull()
  })
})

describe('invitationIsLaidOut', () => {
  it('is false with no invitation, or only the create form’s starter', async () => {
    const { invitationIsLaidOut } = await import('./eventDetailsContent')
    expect(invitationIsLaidOut(null)).toBe(false)
    expect(invitationIsLaidOut({})).toBe(false)
    const starter = withEventDetailsContent({}, { goodToKnow: [dress] }, 'x')
    expect(invitationIsLaidOut(starter)).toBe(false)
  })

  it('is true once a layout or the editor has written its own tiles', async () => {
    const { invitationIsLaidOut } = await import('./eventDetailsContent')
    expect(invitationIsLaidOut(invitation)).toBe(true)
  })
})
