/**
 * What in a tile the host wrote, as opposed to how the layout dresses it.
 *
 * Changing layout changes the look and never the content. Everything listed
 * here survives a layout change; everything else in a tile's settings - sizes,
 * alignment, borders, colours, arrangement - is the layout's to set.
 *
 * Layouts ship sample copy and pictures of their own ("Join us for an evening
 * to remember.", a sample poster). A value still exactly as the previous layout
 * shipped it is that layout's, not the host's, so it stays behind and the new
 * layout's sample shows instead. Without the previous layout to compare
 * against, everything filled in counts as the host's: losing a host's words is
 * worse than keeping a sample.
 */

import type { InviteConfig, Tile, TileType } from './schema'

export const TILE_CONTENT_FIELDS: Partial<Record<TileType, readonly string[]>> = {
  title: ['text', 'eyebrow', 'subtitle'],
  'event-details': ['date', 'time', 'endTime', 'repeats', 'location', 'goodToKnow'],
  directions: ['mapUrl', 'coordinates', 'locationVerified', 'addressLine', 'heading', 'zoom'],
  description: ['content'],
  gallery: ['images', 'eyebrow', 'title'],
  poster: ['src', 'textOverlays'],
  'feature-buttons': ['rsvpLabel', 'registryLabel', 'ctaCardLabel'],
  footer: ['text'],
}

/**
 * Tiles whose content would be lost if the new layout has no tile of the type:
 * they come along, enabled or not as the host left them - a title at the top,
 * the rest after Event Details. (A poster the new layout lacks is left out on
 * purpose: the editor already asks before a layout without one replaces it.)
 */
const KEPT_WHEN_MISSING: readonly TileType[] = ['title', 'event-details', 'directions', 'gallery', 'description']

function isFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (Array.isArray(value)) return value.length > 0
  return true
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function firstOfType(config: InviteConfig | null | undefined, type: TileType): Tile | undefined {
  return [...(config?.tiles ?? [])].sort((a, b) => a.order - b.order).find((t) => t.type === type)
}

/**
 * The host's content in a tile: its listed fields that hold something, minus
 * any still exactly as `previousLayout` shipped them.
 */
export function contentOf(tile: Tile, previousLayout?: InviteConfig | null): Record<string, unknown> {
  const fields = TILE_CONTENT_FIELDS[tile.type] ?? []
  const settings = (tile.settings ?? {}) as unknown as Record<string, unknown>
  const sample = (firstOfType(previousLayout, tile.type)?.settings ?? {}) as unknown as Record<string, unknown>
  const content: Record<string, unknown> = {}
  for (const field of fields) {
    const value = settings[field]
    if (!isFilled(value)) continue
    if (previousLayout && same(value, sample[field])) continue
    content[field] = value
  }
  return content
}

function newTileId(type: string): string {
  return `tile-${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Lay the host's content from `current` over freshly applied layout tiles.
 *
 * Per type, the first current tile with content is the source, and it fills
 * the first new tile of that type. Its fields win over whatever the layout or
 * the event merge put there; empty fields never wipe a value. A content tile
 * the layout lacks comes along (see KEPT_WHEN_MISSING).
 */
export function carryContent(
  tiles: Tile[],
  current?: InviteConfig | null,
  previousLayout?: InviteConfig | null,
): Tile[] {
  const currentTiles = [...(current?.tiles ?? [])].sort((a, b) => a.order - b.order)
  if (currentTiles.length === 0) return tiles

  const sources = new Map<TileType, Tile>()
  for (const tile of currentTiles) {
    if (!sources.has(tile.type) && Object.keys(contentOf(tile, previousLayout)).length > 0) {
      sources.set(tile.type, tile)
    }
  }
  if (sources.size === 0) return tiles

  const filled = new Set<TileType>()
  const merged = [...tiles]
    .sort((a, b) => a.order - b.order)
    .map((tile) => {
      const source = sources.get(tile.type)
      if (!source || filled.has(tile.type)) return tile
      filled.add(tile.type)
      return {
        ...tile,
        settings: { ...tile.settings, ...contentOf(source, previousLayout) } as Tile['settings'],
      }
    })

  const missing = KEPT_WHEN_MISSING.filter((type) => sources.has(type) && !filled.has(type))
  if (missing.length === 0) return merged

  const added = missing.map((type) => {
    const source = sources.get(type) as Tile
    return { ...source, id: newTileId(type), overlayTargetId: undefined, previewOrder: undefined }
  })
  const anchor = merged.findIndex((tile) => tile.type === 'event-details')
  merged.splice(anchor === -1 ? merged.length : anchor + 1, 0, ...added.filter((t) => t.type !== 'title'))
  merged.unshift(...added.filter((t) => t.type === 'title'))
  return merged.map((tile, index) => ({ ...tile, order: index }))
}
