import type { TitleTileSettings } from './schema'

/**
 * Which step of the page's type scale a headline sits on.
 *
 * Size stays with the tile because it is hierarchy - is this the invitation's
 * name or a smaller line - while the scale itself belongs to the page. The tile
 * picks a step; it does not pick a typeface, a weight or a tracking.
 *
 * Shared by the client tile and its server twin so the two cannot drift, which
 * they already had: medium was `text-4xl` on one and `text-3xl md:text-4xl` on
 * the other, so a title changed size when the page hydrated.
 */
export const TITLE_SIZE_STEP: Record<NonNullable<TitleTileSettings['size']>, string> = {
  small: 'clamp(1.5rem, 4vw, 1.875rem)',
  medium: 'clamp(1.875rem, 6vw, 2.5rem)',
  large: 'clamp(2.25rem, 7.5vw, 3rem)',
  xlarge: 'clamp(2.5rem, 9vw, 4rem)',
}

export const SUBTITLE_SIZE_STEP: Record<NonNullable<TitleTileSettings['subtitleSize']>, string> = {
  small: '0.8125rem',
  medium: '1rem',
  large: '1.125rem',
}
