/**
 * Shared defaults for staff page layout studio (new template + Add tile).
 * Keeps starter layouts and incremental adds in sync.
 */

import type { Tile, TileSettings, TileType } from './schema'

export interface PageLayoutStudioSampleContext {
  title: string
  date?: string
  city?: string
}

export function buildDefaultTileSettingsRecord(
  ctx: PageLayoutStudioSampleContext
): Record<TileType, TileSettings> {
  const fallbackDate = ctx.date ?? new Date().toISOString().split('T')[0]
  return {
    title: { text: ctx.title || 'Sample Event' },
    image: { src: '', fitMode: 'fit-to-screen' },
    'greeting-card': {
      backgroundGradient: 'linear-gradient(135deg, #fce4ec, #f48fb1)',
      textOverlays: [],
    },
    timer: { enabled: true, format: 'circle', circleColor: '#0D6EFD', textColor: '#000000' },
    'event-details': {
      location: ctx.city ?? '',
      date: fallbackDate,
    },
    description: { content: '' },
    'feature-buttons': { buttonColor: '#0D6EFD' },
    footer: { text: '' },
    'event-carousel': {
      showFields: { image: true, title: true, dateTime: true, location: true, cta: true },
    },
  }
}

/** Minimal enabled tiles for new staff templates: hero card + core invite blocks. */
export function minimalStaffPageLayoutStarterTiles(ctx: PageLayoutStudioSampleContext): Tile[] {
  const s = buildDefaultTileSettingsRecord(ctx)
  return [
    { id: 'tile-title-0', type: 'title', enabled: true, order: 0, settings: s.title },
    {
      id: 'tile-greeting-card-1',
      type: 'greeting-card',
      enabled: true,
      order: 1,
      settings: s['greeting-card'],
    },
    {
      id: 'tile-event-details-2',
      type: 'event-details',
      enabled: true,
      order: 2,
      settings: s['event-details'],
    },
    {
      id: 'tile-feature-buttons-3',
      type: 'feature-buttons',
      enabled: true,
      order: 3,
      settings: s['feature-buttons'],
    },
  ]
}
