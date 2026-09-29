/**
 * Who owns the space above the first tile.
 *
 * The page owns the gap between two tiles (--space-section); tiles carry no
 * vertical padding of their own. That left the top edge unowned, so a page
 * that opens with text - a title, a description - started flush against the
 * top of the screen. The page owns that edge too, with the same token.
 *
 * The one exception is a poster: it is the hero picture and is meant to run
 * to the top edge.
 */

import type { TileType } from './schema'

/** Tiles that are a picture meant to meet the top of the screen. */
const TOP_BLEED_TILES: ReadonlySet<TileType> = new Set<TileType>(['poster'])

export function pageTopInset(firstTileType: TileType | undefined): string {
  if (!firstTileType || TOP_BLEED_TILES.has(firstTileType)) return '0px'
  return 'var(--space-section)'
}
