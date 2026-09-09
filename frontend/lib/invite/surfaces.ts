import type { CSSProperties } from 'react'

/**
 * How a tile asks to be a surface.
 *
 * A surface is a card, a framed print, a poster - something the invitation
 * draws a box around. Radius, fill, border, blur and shadow arrive together,
 * because they are one decision: a page set flat with frosted cards should get
 * translucent cards that cast nothing, and that only works if the material
 * cannot smuggle in a shadow of its own. It used to. Both tiles that offered
 * glass hardcoded a drop shadow inside the glass recipe, so turning the page
 * flat left two cards floating over it.
 *
 * Elevation travels as a custom property keyed by tile id rather than through
 * context or a prop. Under `featured` the page publishes `--lift-<id>` for the
 * one surface that rises; every other tile falls through to `--shadow-rest`.
 * The tile does not learn whether it is special - it asks the same question and
 * the page has already answered.
 */
export function surface(tileId?: string, overrides?: CSSProperties): CSSProperties {
  return {
    borderRadius: 'var(--radius-surface)',
    background: 'var(--surface-fill)',
    border: 'var(--surface-border)',
    backdropFilter: 'var(--surface-blur)',
    WebkitBackdropFilter: 'var(--surface-blur)',
    // Elevation first, then the material's own inner highlight. Glass gets a
    // top edge catch-light; solid contributes a no-op so the list stays valid.
    boxShadow: `${surfaceShadow(tileId)}, var(--surface-inset)`,
    ...overrides,
  } as CSSProperties
}

/**
 * The shadow alone, for surfaces that draw their own box.
 *
 * A polaroid is white card stock, not the invitation's material - it should not
 * turn frosted because the page did. It still rises and falls with the page's
 * depth.
 */
export function surfaceShadow(tileId?: string): string {
  return tileId ? `var(--lift-${tileId}, var(--shadow-rest))` : 'var(--shadow-rest)'
}
