/**
 * A change of layout changes the look and keeps the host's words.
 */

import { describe, expect, it } from 'vitest'
import { applyLayout } from './applyLayout'
import type { InviteConfig, Tile } from './schema'

function tile(type: Tile['type'], order: number, settings: Record<string, unknown>, enabled = true): Tile {
  return { id: `${type}-${order}`, type, enabled, order, settings: settings as unknown as Tile['settings'] }
}

/** A layout as stored: its own look, sample copy, no host content. */
const layout: InviteConfig = {
  tiles: [
    tile('title', 0, { text: 'Event Title', size: 'xlarge' }),
    tile('event-details', 1, { date: '2026-01-01', location: '', dateLayout: 'compact', borderStyle: 'glass' }),
    tile('description', 2, { content: '<p>Join us for an evening to remember.</p>' }),
    tile('feature-buttons', 3, {}),
  ],
} as InviteConfig

/** The invitation as the host left it under the previous layout. */
const current: InviteConfig = {
  tiles: [
    tile('title', 0, { text: 'Riya & Kabir', size: 'small' }),
    tile('event-details', 1, {
      date: '2026-12-12',
      time: '19:00',
      endTime: '23:00',
      location: 'The Lakeside Lawns, Udaipur',
      goodToKnow: [{ id: 'gtk-1', kind: 'dress', text: 'Pastels' }],
      dateLayout: 'single-line',
      borderStyle: 'ornate',
    }),
    tile('directions', 2, { mapUrl: 'The Lakeside Lawns, Udaipur', coordinates: { lat: 24.58, lng: 73.71 }, zoom: 14 }, false),
    tile('description', 3, { content: '<p>Our own words.</p>' }),
  ],
} as InviteConfig

const event = { title: 'Riya & Kabir', date: '2026-12-12', city: 'Udaipur' }

function byType(config: InviteConfig, type: Tile['type']) {
  return config.tiles!.find((t) => t.type === type)!.settings as unknown as Record<string, unknown>
}

describe('applying a layout over an invitation that has content', () => {
  const applied = applyLayout(layout, event, undefined, 'layout-2', current)

  it('keeps the time, venue and Good to know typed into Event Details', () => {
    expect(byType(applied, 'event-details')).toMatchObject({
      date: '2026-12-12',
      time: '19:00',
      endTime: '23:00',
      location: 'The Lakeside Lawns, Udaipur',
      goodToKnow: [{ id: 'gtk-1', kind: 'dress', text: 'Pastels' }],
    })
  })

  it('takes the look from the new layout, not the old one', () => {
    expect(byType(applied, 'event-details')).toMatchObject({ dateLayout: 'compact', borderStyle: 'glass' })
    expect(byType(applied, 'title').size).toBe('xlarge')
  })

  it('brings a filled-in map along when the new layout has no Directions tile, as the host left it', () => {
    const tiles = [...applied.tiles!].sort((a, b) => a.order - b.order)
    const types = tiles.map((t) => t.type)
    expect(types.indexOf('directions')).toBe(types.indexOf('event-details') + 1)
    const directions = tiles.find((t) => t.type === 'directions')!
    expect(directions.enabled).toBe(false)
    expect(directions.settings).toMatchObject({ coordinates: { lat: 24.58, lng: 73.71 } })
    expect(directions.id).not.toBe('directions-2')
    expect(tiles.map((t) => t.order)).toEqual([0, 1, 2, 3, 4])
  })

  it('leaves description to the layout, since layouts ship sample text there', () => {
    expect(byType(applied, 'description').content).toBe('<p>Join us for an evening to remember.</p>')
  })
})

describe('content that is not there', () => {
  it('an empty field never wipes what the layout or event provides', () => {
    const blank: InviteConfig = {
      tiles: [tile('event-details', 0, { date: '2026-12-12', time: '', location: '   ' })],
    } as InviteConfig
    const applied = applyLayout(layout, event, undefined, 'l', blank)
    expect(byType(applied, 'event-details')).toMatchObject({ location: 'Udaipur', date: '2026-12-12' })
    expect(byType(applied, 'event-details').time).toBeUndefined()
  })

  it('without a current invitation, applying behaves as before', () => {
    const before = applyLayout(layout, event, undefined, 'l')
    expect(byType(before, 'event-details')).toMatchObject({ date: '2026-12-12', location: 'Udaipur' })
    expect(before.tiles!.map((t) => t.type)).toEqual(layout.tiles!.map((t) => t.type))
  })

  it('a starter layout, which skips the event merge, still keeps the host content', () => {
    const applied = applyLayout(layout, undefined, { mergeEventIntoTitle: false, mergeEventIntoDetails: false }, 's', current)
    expect(byType(applied, 'event-details')).toMatchObject({ time: '19:00', location: 'The Lakeside Lawns, Udaipur' })
  })
})
