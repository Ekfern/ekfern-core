import { describe, expect, it } from 'vitest'
import {
  CONTRAST_FLOOR,
  compositeOver,
  contrastRatio,
  contrastSurfaces,
  deriveInk,
  ensureContrast,
  gradientStops,
  worstContrast,
} from './paletteUtils'

/** The gradient on the live `no-theme-id` invitation. */
const LIVE_GRADIENT = 'linear-gradient(160deg, #E8D8C3 0%, #C4A882 100%)'

describe('contrastRatio', () => {
  it('spans the WCAG range', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
    expect(contrastRatio('#7F7F7F', '#7F7F7F')).toBeCloseTo(1, 5)
  })

  it('does not care which way round the pair is given', () => {
    expect(contrastRatio('#1F1B16', '#E8D8C3')).toBeCloseTo(contrastRatio('#E8D8C3', '#1F1B16'), 10)
  })
})

describe('gradientStops', () => {
  it('reads every stop, not just the first', () => {
    expect(gradientStops(LIVE_GRADIENT)).toEqual(['#E8D8C3', '#C4A882'])
  })

  it('reads rgb() stops', () => {
    expect(gradientStops('linear-gradient(rgb(255,0,0), rgb(0,0,255))')).toEqual(['#FF0000', '#0000FF'])
  })

  it('returns nothing for a gradient with no colours it understands', () => {
    expect(gradientStops('linear-gradient(currentColor, transparent)')).toEqual([])
  })
})

describe('contrastSurfaces', () => {
  it('is the single colour for a flat background', () => {
    expect(contrastSurfaces({ backgroundColor: '#E8D8C3' })).toEqual(['#E8D8C3'])
  })

  it('is the darkest and lightest stop of a gradient', () => {
    // Ink chosen against the pale first stop can be invisible on the last one,
    // which is why the average is not good enough.
    expect(contrastSurfaces({ backgroundGradient: LIVE_GRADIENT }).sort()).toEqual(
      ['#C4A882', '#E8D8C3'].sort(),
    )
  })

  it('adds the glass composite, because text on a card sits on the blend', () => {
    const solid = contrastSurfaces({ backgroundColor: '#15131C', material: 'solid' })
    const glass = contrastSurfaces({ backgroundColor: '#15131C', material: 'glass' })
    expect(glass.length).toBe(solid.length * 2)
    expect(glass).toContain(compositeOver('#FFFFFF', 0.14, '#15131C'))
  })
})

describe('ensureContrast', () => {
  it('leaves ink alone when it already clears', () => {
    expect(ensureContrast('#000000', ['#FFFFFF'], CONTRAST_FLOOR.body)).toBe('#000000')
  })

  it('rescues ink that a luminance test would have called fine', () => {
    // #808080 is "dark", so the old rule picked white - at 3.95:1, under the floor.
    const surfaces = ['#808080']
    expect(worstContrast('#FFFFFF', surfaces)).toBeLessThan(CONTRAST_FLOOR.body)
    expect(worstContrast(ensureContrast('#FFFFFF', surfaces), surfaces)).toBeGreaterThanOrEqual(
      CONTRAST_FLOOR.body,
    )
  })

  it('clears every surface, not just the easy one', () => {
    const surfaces = ['#FFFFFF', '#101010']
    const ink = ensureContrast('#777777', surfaces, CONTRAST_FLOOR.large)
    expect(worstContrast(ink, surfaces)).toBeGreaterThanOrEqual(CONTRAST_FLOOR.large)
  })

  it('returns the most legible candidate it found when the floor is unreachable', () => {
    // Nothing clears 4.5:1 against both extremes at once.
    const impossible = ['#FFFFFF', '#000000']
    const ink = ensureContrast('#FFFFFF', impossible, CONTRAST_FLOOR.body)
    expect(worstContrast(ink, impossible)).toBeGreaterThan(worstContrast('#FFFFFF', impossible))
  })
})

describe('deriveInk', () => {
  const cases: Array<[string, Parameters<typeof deriveInk>[0]]> = [
    ['pale flat', { backgroundColor: '#E8D8C3' }],
    ['dark flat', { backgroundColor: '#15131C' }],
    ['mid-tone flat', { backgroundColor: '#808080' }],
    ['the live gradient', { backgroundGradient: LIVE_GRADIENT }],
    ['the live gradient on glass', { backgroundGradient: LIVE_GRADIENT, material: 'glass' }],
    ['dark page on glass', { backgroundColor: '#15131C', material: 'glass' }],
  ]

  it.each(cases)('%s: ink and muted clear the body floor', (_name, opts) => {
    const surfaces = contrastSurfaces(opts)
    const { fontColor, mutedColor } = deriveInk(opts)
    expect(worstContrast(fontColor, surfaces)).toBeGreaterThanOrEqual(CONTRAST_FLOOR.body)
    expect(worstContrast(mutedColor, surfaces)).toBeGreaterThanOrEqual(CONTRAST_FLOOR.body)
  })

  it.each(cases)('%s: accent clears the large floor', (_name, opts) => {
    const { primaryColor } = deriveInk(opts)
    expect(worstContrast(primaryColor, contrastSurfaces(opts))).toBeGreaterThanOrEqual(
      CONTRAST_FLOOR.large,
    )
  })

  it('is the guarantee that lets the per-tile fontColor escape hatch go', () => {
    // Every seeded background, plus the awkward middle of the range.
    for (let value = 0; value <= 255; value += 15) {
      const hex = `#${value.toString(16).padStart(2, '0').repeat(3)}`.toUpperCase()
      const surfaces = contrastSurfaces({ backgroundColor: hex })
      expect(worstContrast(deriveInk({ backgroundColor: hex }).fontColor, surfaces)).toBeGreaterThanOrEqual(
        CONTRAST_FLOOR.body,
      )
    }
  })
})
