import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ComposedPage from './ComposedPage'
import { OPTICAL_SPLIT } from '@/lib/invite/pageEdges'

/**
 * A short page sits at the card's optical centre with the branding at its foot;
 * a long one is the ordinary top-aligned scroll. Both fall out of two spacers
 * that share the leftover height - these cases pin their order and that they
 * move the block vertically and nothing else.
 */

const TILES = '<div id="tiles">tiles</div>'
const FOOT = '<p id="foot">Create your own</p>'

function html(firstTileType: Parameters<typeof ComposedPage>[0]['firstTileType'], withFoot = true) {
  return renderToStaticMarkup(
    <ComposedPage firstTileType={firstTileType} foot={withFoot ? <p id="foot">Create your own</p> : undefined}>
      <div id="tiles">tiles</div>
    </ComposedPage>,
  )
}

describe('ComposedPage', () => {
  it('splits the leftover height around the tiles, then the foot', () => {
    const out = html('title')
    const above = out.indexOf('data-page-space="above"')
    const tiles = out.indexOf(TILES)
    const below = out.indexOf('data-page-space="below"')
    const foot = out.indexOf(FOOT)
    expect([above, tiles, below, foot].every(i => i >= 0)).toBe(true)
    expect(above).toBeLessThan(tiles)
    expect(tiles).toBeLessThan(below)
    expect(below).toBeLessThan(foot)
    expect(out).toContain(`flex:${OPTICAL_SPLIT.above} 1 0px`)
    expect(out).toContain(`flex:${OPTICAL_SPLIT.below} 1 0px`)
  })

  it('never lowers a poster hero off the top edge', () => {
    const out = html('poster')
    expect(out).not.toContain('data-page-space="above"')
    expect(out).toContain('padding-top:0px')
  })

  it('ends at the lower spacer when there is no foot', () => {
    const out = html('title', false)
    expect(out).not.toContain('id="foot"')
    expect(out.endsWith('<div aria-hidden="true" data-page-space="below" style="flex:55 1 0px"></div></div>')).toBe(true)
  })

  it('moves the block vertically only', () => {
    // Nothing that would realign the tiles across the page.
    expect(html('title')).not.toMatch(/text-align|align-items|justify-content|margin-left|margin-right/)
  })
})
