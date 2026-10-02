import React from 'react'
import type { TileType } from '@/lib/invite/schema'
import { OPTICAL_SPLIT, opensWithBleed, pageTopInset } from '@/lib/invite/pageEdges'

interface ComposedPageProps {
  /** The first tile shown; a poster runs to the top edge and is never lowered. */
  firstTileType: TileType | undefined
  /** The tile column. Moved as one block - nothing inside it is realigned. */
  children: React.ReactNode
  /** Sits at the foot of the card, like a printer's mark - the branding line. */
  foot?: React.ReactNode
}

/**
 * The page's vertical composition, shared by the invitation and the editor's
 * phone so the two cannot place a short page differently.
 *
 * Two spacers share whatever height the tiles leave over, `OPTICAL_SPLIT`
 * above and below, which lifts a short block to the card's optical centre and
 * drops the foot to the bottom edge. With no height left over they are zero
 * and the page is the ordinary top-aligned scroll. Vertical only: the spacers
 * add space above and below the block and touch nothing across it, so the
 * host's alignment is exactly as chosen.
 *
 * Needs a parent that is a flex column at least as tall as the screen.
 */
export default function ComposedPage({ firstTileType, children, foot }: ComposedPageProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 0 auto',
        paddingTop: pageTopInset(firstTileType),
      }}
    >
      {!opensWithBleed(firstTileType) && (
        <div aria-hidden data-page-space="above" style={{ flex: `${OPTICAL_SPLIT.above} 1 0px` }} />
      )}
      {children}
      <div aria-hidden data-page-space="below" style={{ flex: `${OPTICAL_SPLIT.below} 1 0px` }} />
      {foot}
    </div>
  )
}
