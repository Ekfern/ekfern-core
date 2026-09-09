import { describe, expect, it } from 'vitest'
import { resolveAppearance } from '@/lib/invite/appearance'
import {
  CONTRAST_FLOOR,
  contrastSurfaces,
  ensureContrast,
  mixHex,
  worstContrast,
} from '@/lib/invite/paletteUtils'

/**
 * The credit at the foot of the page has to stay readable.
 *
 * It shipped as gray-400 on a host-chosen background and measured 1.12:1 on
 * this project's own seeded gradient - the floor is 4.5 - which nothing caught
 * because nothing was looking. These colours are derived the same way the
 * component derives them, so a palette that would push them back under the
 * floor fails here instead of on someone's invitation.
 */
function brandingInk(config: Parameters<typeof resolveAppearance>[0]) {
  const appearance = resolveAppearance(config)
  const surfaces = contrastSurfaces({
    backgroundColor: appearance.backgroundColor,
    backgroundGradient: appearance.backgroundGradient,
    material: appearance.material,
  })
  const quiet = ensureContrast(
    mixHex(appearance.fontColor, surfaces[0] ?? appearance.backgroundColor, 0.45),
    surfaces,
    CONTRAST_FLOOR.body,
  )
  // The link must be at least as legible as the sentence it sits in, not merely
  // above the floor: pushed independently, a quietened ink can overshoot and
  // end up clearer than the link, which is the wrong way round for the one
  // element being offered.
  const link = ensureContrast(
    appearance.fontColor,
    surfaces,
    Math.max(CONTRAST_FLOOR.body, worstContrast(quiet, surfaces)),
  )
  return { surfaces, quiet, link }
}

const PALETTES: Array<[string, any]> = [
  ['defaults', null],
  [
    'the seeded tan gradient',
    { customColors: { fontColor: '#1F1B16', backgroundColor: '#15131C', backgroundGradient: 'linear-gradient(160deg, #E8D8C3 0%, #C4A882 100%)' } },
  ],
  ['a dark page', { customColors: { fontColor: '#F5F5F5', backgroundColor: '#15131C' } }],
  ['a white page', { customColors: { fontColor: '#111111', backgroundColor: '#FFFFFF' } }],
  ['ink close to its ground', { customColors: { fontColor: '#8A8A8A', backgroundColor: '#909090' } }],
]

describe('the footer credit', () => {
  it.each(PALETTES)('clears the body floor on %s', (_name, config) => {
    const { surfaces, quiet, link } = brandingInk(config)
    expect(worstContrast(quiet, surfaces)).toBeGreaterThanOrEqual(CONTRAST_FLOOR.body)
    expect(worstContrast(link, surfaces)).toBeGreaterThanOrEqual(CONTRAST_FLOOR.body)
  })

  it.each(PALETTES)('keeps the link at least as legible as the sentence on %s', (_name, config) => {
    const { surfaces, quiet, link } = brandingInk(config)
    expect(worstContrast(link, surfaces)).toBeGreaterThanOrEqual(worstContrast(quiet, surfaces))
  })

  it('is what the old hardcoded greys could not do', () => {
    const { surfaces } = brandingInk(PALETTES[1][1])
    expect(worstContrast('#9CA3AF', surfaces)).toBeLessThan(CONTRAST_FLOOR.body)
    expect(worstContrast('#6B7280', surfaces)).toBeLessThan(CONTRAST_FLOOR.body)
  })
})
