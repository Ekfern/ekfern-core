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

  it('keeps the host’s own description', () => {
    expect(byType(applied, 'description').content).toBe('<p>Our own words.</p>')
  })
})

describe('content changes nothing but the look', () => {
  /** What layout A shipped: the host has applied it and edited some of it. */
  const layoutA: InviteConfig = {
    tiles: [
      tile('title', 0, { text: 'Event Title', eyebrow: 'SAVE THE DATE', size: 'large' }),
      tile('poster', 1, { src: 'https://cdn/sample-a.jpg' }),
      tile('description', 2, { content: '<p>Sample from A.</p>' }),
      tile('event-details', 3, { date: '2026-01-01', location: '' }),
    ],
  } as InviteConfig

  const afterA: InviteConfig = {
    appliedLayoutId: 'A',
    tiles: [
      tile('title', 0, { text: 'Riya weds Kabir', eyebrow: 'SAVE THE DATE', size: 'large' }),
      tile('poster', 1, { src: 'https://cdn/sample-a.jpg' }),
      tile('description', 2, { content: '<p>Sample from A.</p>' }),
      tile('event-details', 3, { date: '2026-12-12', location: 'Udaipur' }),
      tile('gallery', 4, { images: [{ id: 'p1', src: 'https://cdn/us.jpg' }] }),
    ],
  } as InviteConfig

  const layoutB: InviteConfig = {
    tiles: [
      tile('title', 0, { text: 'Event Title', eyebrow: 'YOU ARE INVITED', size: 'small' }),
      tile('poster', 1, { src: 'https://cdn/sample-b.jpg' }),
      tile('description', 2, { content: '<p>Sample from B.</p>' }),
      tile('event-details', 3, { date: '2026-01-01', location: '' }),
    ],
  } as InviteConfig

  const switched = applyLayout(layoutB, { title: 'Sharma wedding', date: '2026-12-12', city: 'Udaipur' }, undefined, 'B', afterA, layoutA)

  it('keeps the headline the host wrote over the event title', () => {
    expect(byType(switched, 'title')).toMatchObject({ text: 'Riya weds Kabir', size: 'small' })
  })

  it('lets the new layout’s samples show where the host never changed the old ones', () => {
    expect(byType(switched, 'title').eyebrow).toBe('YOU ARE INVITED')
    expect(byType(switched, 'poster').src).toBe('https://cdn/sample-b.jpg')
    expect(byType(switched, 'description').content).toBe('<p>Sample from B.</p>')
  })

  it('brings the host’s photos along though the new layout has no gallery', () => {
    expect(byType(switched, 'gallery').images).toEqual([{ id: 'p1', src: 'https://cdn/us.jpg' }])
  })

  it('without the previous layout to compare, keeps everything filled in', () => {
    const blind = applyLayout(layoutB, undefined, { mergeEventIntoTitle: false, mergeEventIntoDetails: false }, 'B', afterA)
    expect(byType(blind, 'poster').src).toBe('https://cdn/sample-a.jpg')
    expect(byType(blind, 'title').text).toBe('Riya weds Kabir')
  })

  it('without an Event Details tile, carried tiles go before the footer, not after it', () => {
    const posterOnly: InviteConfig = {
      tiles: [tile('poster', 0, {}), tile('footer', 1, { text: 'Made with care.' })],
    } as InviteConfig
    const next = applyLayout(posterOnly, undefined, undefined, 'P', afterA, layoutA)
    const types = [...next.tiles!].sort((a, b) => a.order - b.order).map((t) => t.type)
    expect(types[types.length - 1]).toBe('footer')
    expect(types).toContain('event-details')
  })

  it('a missing title comes back at the top', () => {
    const noTitle: InviteConfig = { tiles: [tile('event-details', 0, { date: '2026-01-01', location: '' })] } as InviteConfig
    const next = applyLayout(noTitle, undefined, undefined, 'C', afterA, layoutA)
    const first = [...next.tiles!].sort((a, b) => a.order - b.order)[0]
    expect(first).toMatchObject({ type: 'title', settings: { text: 'Riya weds Kabir' } })
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
