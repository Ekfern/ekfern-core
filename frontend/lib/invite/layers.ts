/**
 * The invite is a printed card, and its layers are the card's physical parts.
 *
 *   Opening   envelope / curtain - the card is inside it until opened (OpeningLayer)
 *   Air       petals, lanterns, balloons - in the room, in front of the card
 *   ── the card ──
 *   Edge      page frame, border - nothing the page contains is in front of its edge
 *   Content   tiles, with corner decorations printed just beneath them
 *   Paper     background colour + texture - the stock everything is printed on
 *
 * Texture used to sit at `zIndex: 1` beside an unpositioned tile column, which
 * in CSS paints it over every tile: linen lines ran straight through the title
 * and the photos. The fix is structural rather than a bigger number on the
 * tiles. Whoever paints the paper's background becomes a stacking root
 * (`PAPER_ROOT_STYLE`), and the paper's own layers go negative inside it. A
 * negative child of an isolated root paints above that root's background and
 * below all of its ordinary content, so the tiles need no z-index at all and
 * keep their own internal ones (carousel, dropdowns) unchanged. The isolation
 * also keeps every card z-index inside the card, so Air is always in front.
 */
export const INVITE_LAYER = {
  /** The paper's texture: under everything printed on it. */
  paperTexture: -2,
  /** Corner decorations: printed on the paper, beneath the tiles. */
  ornament: -1,
  /** The page frame image: the card's edge, over its content. */
  frame: 5,
  /** The bordered page's border band. */
  border: 10,
  /** Experience modules, outside the card. */
  air: 20,
} as const

/** Put on the element that paints the paper's background. */
export const PAPER_ROOT_STYLE = { isolation: 'isolate' } as const
