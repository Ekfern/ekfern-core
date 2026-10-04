/**
 * What in a tile the host wrote, as opposed to how the layout dresses it.
 *
 * Applying a layout takes the look from the layout and must keep the host's
 * words: switching layouts used to drop the time, the venue and the dress
 * code typed into Event Details, because only the title, date and city were
 * re-filled from the event. Anything listed here survives a layout change;
 * everything else in a tile's settings is the layout's to set.
 *
 * Only fields a layout never ships sample copy for belong here. The title is
 * re-filled from the event already, and stored layouts carry sample
 * description text ("Join us for an evening to remember."), which would follow
 * the host into the next layout if description content were listed.
 */

import type { InviteConfig, Tile, TileType } from './schema'

export const TILE_CONTENT_FIELDS: Partial<Record<TileType, readonly string[]>> = {
  'event-details': ['date', 'time', 'endTime', 'repeats', 'location', 'dressCode'],
  directions: ['mapUrl', 'coordinates', 'locationVerified', 'addressLine'],
}

/**
 * Tiles that exist only to hold host content. When the new layout has no tile
 * of the type but the host had filled one in, the tile comes along rather than
 * the content being dropped.
 */
const CONTENT_ONLY_TILES: readonly TileType[] = ['directions']

function isFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (Array.isArray(value)) return value.length > 0
  return true
}

/** The host's content in a tile: only the listed fields that hold something. */
export function contentOf(tile: Tile): Record<string, unknown> {
  const fields = TILE_CONTENT_FIELDS[tile.type] ?? []
  const settings = (tile.settings ?? {}) as unknown as Record<string, unknown>
  const content: Record<string, unknown> = {}
  for (const field of fields) {
    if (isFilled(settings[field])) content[field] = settings[field]
  }
  return content
}

function newTileId(type: string): string {
  return `tile-${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Lay the host's content from `current` over freshly applied layout tiles.
 *
 * Per type, the first current tile with content is the source. Its filled
 * fields win over whatever the layout or the event merge put there; empty
 * fields never wipe a value. A content-only tile the layout lacks is added
 * right after Event Details, enabled or not as the host left it.
 */
export function carryContent(tiles: Tile[], current?: InviteConfig | null): Tile[] {
  const currentTiles = current?.tiles ?? []
  if (currentTiles.length === 0) return tiles

  const sources = new Map<TileType, Tile>()
  for (const tile of currentTiles) {
    if (!sources.has(tile.type) && Object.keys(contentOf(tile)).length > 0) {
      sources.set(tile.type, tile)
    }
  }
  if (sources.size === 0) return tiles

  const merged = tiles.map((tile) => {
    const source = sources.get(tile.type)
    if (!source) return tile
    return { ...tile, settings: { ...tile.settings, ...contentOf(source) } as Tile['settings'] }
  })

  const missing = CONTENT_ONLY_TILES.filter(
    (type) => sources.has(type) && !merged.some((tile) => tile.type === type),
  )
  if (missing.length === 0) return merged

  const ordered = [...merged].sort((a, b) => a.order - b.order)
  const anchor = ordered.findIndex((tile) => tile.type === 'event-details')
  const insertAt = anchor === -1 ? ordered.length : anchor + 1
  const added = missing.map((type) => {
    const source = sources.get(type) as Tile
    return { ...source, id: newTileId(type), overlayTargetId: undefined, previewOrder: undefined }
  })
  ordered.splice(insertAt, 0, ...added)
  return ordered.map((tile, index) => ({ ...tile, order: index }))
}
