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

/** Whether the page opens with a picture that runs to the top edge. */
export function opensWithBleed(firstTileType: TileType | undefined): boolean {
  return !!firstTileType && TOP_BLEED_TILES.has(firstTileType)
}

export function pageTopInset(firstTileType: TileType | undefined): string {
  if (!firstTileType || opensWithBleed(firstTileType)) return '0px'
  return 'var(--space-section)'
}

/**
 * Where a short page's leftover height goes.
 *
 * A page shorter than the screen used to stack at the top and leave the lower
 * half as blank paper. A printed card composes a short block at its optical
 * centre - a little above the true middle, which the eye reads as low - so the
 * spare height is split this way round, above and below the block. A page
 * taller than the screen has no spare height and nothing moves.
 */
export const OPTICAL_SPLIT = { above: 45, below: 55 } as const
