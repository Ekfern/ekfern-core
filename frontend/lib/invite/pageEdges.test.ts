/**
 * Unit tests for pageTopInset — the page, not the tile, owns the space above
 * the first tile.
 */

import { describe, expect, it } from 'vitest'
import { OPTICAL_SPLIT, opensWithBleed, pageTopInset } from './pageEdges'
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

describe('opensWithBleed', () => {
  it('is true only for a poster hero', () => {
    expect(opensWithBleed('poster')).toBe(true)
    expect(opensWithBleed('title')).toBe(false)
    expect(opensWithBleed(undefined)).toBe(false)
  })
})

describe('OPTICAL_SPLIT', () => {
  it('puts a short page above the true middle, where the eye reads centre', () => {
    expect(OPTICAL_SPLIT.above).toBeLessThan(OPTICAL_SPLIT.below)
  })
})
