import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import TileList from './TileList'
import type { Tile } from '@/lib/invite/schema'

/**
 * The phone preview renders the order it is given.
 *
 * Dragging a tile in the page editor writes `previewOrder` and deliberately
 * leaves the saved `order` alone until the next save. The editor sorts by
 * previewOrder and hands the result here; this list used to sort it again by
 * `order`, which put the tiles straight back where they started. A host dragged
 * a tile, the left panel moved, the phone did not, and nothing said why.
 *
 * So the contract is: the caller owns the order, this list renders it. These
 * cases fail if a sort is ever reintroduced - the input below is deliberately
 * shuffled relative to `order`.
 */

function tile(id: string, type: Tile['type'], order: number, text: string): Tile {
  return { id, type, order, enabled: true, settings: { text, content: text } } as Tile
}

/** Positions of each marker in the rendered markup, in document order. */
function renderedOrder(tiles: Tile[], markers: string[]): string[] {
  const html = renderToStaticMarkup(
    <TileList variant="invite" tiles={tiles} onReorder={() => {}} eventTitle="Event" />
  )
  return markers
    .map((m) => ({ m, at: html.indexOf(m) }))
    .filter((x) => x.at !== -1)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.m)
}

describe('invite preview tile order', () => {
  it('renders the caller order even when `order` disagrees', () => {
    // `order` says Alpha, Bravo. The caller hands them over the other way round,
    // which is what a fresh drag looks like before the draft is saved.
    const tiles = [
      tile('t2', 'title', 1, 'Bravo'),
      tile('t1', 'title', 0, 'Alpha'),
    ]
    expect(renderedOrder(tiles, ['Bravo', 'Alpha'])).toEqual(['Bravo', 'Alpha'])
  })

  it('keeps the footer last whatever order it arrives in', () => {
    const tiles = [
      tile('f', 'footer', 0, 'Footer'),
      tile('t1', 'title', 5, 'Alpha'),
    ]
    expect(renderedOrder(tiles, ['Alpha', 'Footer'])).toEqual(['Alpha', 'Footer'])
  })
})
