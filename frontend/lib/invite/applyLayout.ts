/**
 * Apply an invite page layout: clone config, assign unique tile IDs, optionally merge event data,
 * and set tileSetComplete so the design page does not merge in default tiles.
 */

import type { InviteConfig, Tile } from './schema'

function uniqueTileId(type: string): string {
  return `tile-${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export interface EventDataForLayout {
  title?: string
  date?: string
  city?: string
}

export interface ApplyLayoutOptions {
  /** When false, keeps generic title copy (e.g. mechanical starters). Default true. */
  mergeEventIntoTitle?: boolean
  /** When false, leaves event-details date/location empty. Default true. */
  mergeEventIntoDetails?: boolean
}

/**
 * Clone layout config with unique tile IDs, optional event merge, and tileSetComplete flag.
 * Use when applying a layout from the library or when switching layouts in the editor.
 */
export function applyLayout(
  layoutConfig: InviteConfig,
  event?: EventDataForLayout,
  options?: ApplyLayoutOptions,
): InviteConfig {
  const mergeTitle = options?.mergeEventIntoTitle !== false
  const mergeDetails = options?.mergeEventIntoDetails !== false
  const tiles = layoutConfig.tiles
  if (!tiles || tiles.length === 0) {
    return {
      ...layoutConfig,
      tileSetComplete: true,
    }
  }

  const idMap: Record<string, string> = {}
  const newTiles: Tile[] = tiles.map((t) => {
    const newId = uniqueTileId(t.type)
    idMap[t.id] = newId
    return { ...t, id: newId }
  })

  // Resolve overlayTargetId to new ids now that idMap is complete
  const resolvedTiles = newTiles.map((t) => {
    if (t.overlayTargetId != null && idMap[t.overlayTargetId]) {
      return { ...t, overlayTargetId: idMap[t.overlayTargetId] }
    }
    return t
  })

  // Optional event merge: fill title and event-details from event
  let mergedTiles = resolvedTiles
  if (event) {
    mergedTiles = resolvedTiles.map((t) => {
      if (
        mergeTitle &&
        t.type === 'title' &&
        t.settings &&
        typeof t.settings === 'object' &&
        'text' in t.settings
      ) {
        return {
          ...t,
          settings: { ...t.settings, text: event.title ?? (t.settings as { text?: string }).text ?? 'Event Title' },
        }
      }
      if (mergeDetails && t.type === 'event-details' && t.settings && typeof t.settings === 'object') {
        const s = t.settings as { date?: string; location?: string }
        return {
          ...t,
          settings: {
            ...t.settings,
            date: event.date ?? s.date ?? new Date().toISOString().split('T')[0],
            location: event.city ?? s.location ?? '',
          },
        }
      }
      return t
    })
  }

  return {
    ...layoutConfig,
    tiles: mergedTiles,
    tileSetComplete: true,
    customColors: layoutConfig.customColors ?? {},
  }
}
