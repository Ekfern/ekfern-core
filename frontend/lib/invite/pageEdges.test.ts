/**
 * Unit tests for pageTopInset — the page, not the tile, owns the space above
 * the first tile.
 */

import { describe, expect, it } from 'vitest'
import { pageTopInset } from './pageEdges'
import type { TileType } from './schema'

describe('pageTopInset', () => {
  it('gives a page that opens with text the same breathing room as between tiles', () => {
    const textFirst: TileType[] = ['title', 'description', 'event-details', 'timer', 'feature-buttons', 'gallery']
    for (const type of textFirst) {
      expect(pageTopInset(type)).toBe('var(--space-section)')
    }
  })

  it('lets a poster hero run to the top edge', () => {
    expect(pageTopInset('poster')).toBe('0px')
  })

  it('adds nothing to an empty page', () => {
    expect(pageTopInset(undefined)).toBe('0px')
  })
})
