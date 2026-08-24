import { describe, expect, it } from 'vitest'
import { resolveAppearance } from './appearance'
import type { InviteConfig } from './schema'

const tiles = [
  { id: 't-title', type: 'title', order: 0, enabled: true, settings: {} },
  { id: 't-details', type: 'event-details', order: 1, enabled: true, settings: {} },
  { id: 't-cta', type: 'feature-buttons', order: 2, enabled: true, settings: {} },
] as unknown as InviteConfig['tiles']

describe('depth', () => {
  it.each([
    ['raised', 'uniform'],
    ['lifted', 'uniform'],
    ['flat', 'flat'],
    ['uniform', 'uniform'],
    ['featured', 'featured'],
  ] as const)('%s resolves to %s', (given, expected) => {
    expect(resolveAppearance({ depth: given } as InviteConfig).depth).toBe(expected)
  })

  it('defaults to uniform, which is what raised always meant', () => {
    expect(resolveAppearance({}).depth).toBe('uniform')
    expect(resolveAppearance({}).shadowRest).toBe(resolveAppearance({ depth: 'raised' } as InviteConfig).shadowRest)
  })

  it('casts nothing at all when flat', () => {
    const flat = resolveAppearance({ depth: 'flat' } as InviteConfig)
    expect(flat.shadowRest).toBe('none')
    expect(flat.shadowLift).toBe('none')
  })

  it('lays the page flat under featured, so one surface can carry the difference', () => {
    const featured = resolveAppearance({ depth: 'featured', tiles } as InviteConfig)
    expect(featured.shadowRest).toBe('none')
    expect(featured.shadowLift).not.toBe('none')
  })
})

describe('the featured surface', () => {
  it('is the event details card by preference', () => {
    expect(resolveAppearance({ depth: 'featured', tiles } as InviteConfig).featuredTileId).toBe('t-details')
  })

  it('falls to the buttons when there are no details', () => {
    const without = tiles!.filter((t) => t.type !== 'event-details')
    expect(resolveAppearance({ depth: 'featured', tiles: without } as InviteConfig).featuredTileId).toBe('t-cta')
  })

  it('ignores a disabled tile', () => {
    const disabled = tiles!.map((t) => (t.type === 'event-details' ? { ...t, enabled: false } : t))
    expect(resolveAppearance({ depth: 'featured', tiles: disabled } as InviteConfig).featuredTileId).toBe('t-cta')
  })

  it('honours an explicit choice from a template', () => {
    expect(
      resolveAppearance({ depth: 'featured', featuredTileId: 't-title', tiles } as InviteConfig).featuredTileId,
    ).toBe('t-title')
  })

  it('is nobody unless the page asked to feature something', () => {
    expect(resolveAppearance({ depth: 'uniform', tiles } as InviteConfig).featuredTileId).toBeNull()
    expect(resolveAppearance({ depth: 'flat', tiles } as InviteConfig).featuredTileId).toBeNull()
  })
})

describe('material', () => {
  it('never contributes a shadow - that was the whole bug', () => {
    // Glass used to hardcode its own drop shadow in two tiles, so a page set
    // flat still had two cards floating over it.
    const flatGlass = resolveAppearance({ depth: 'flat', material: 'glass' } as InviteConfig)
    expect(flatGlass.shadowRest).toBe('none')
    expect(flatGlass.shadowLift).toBe('none')
    expect(flatGlass.surfaceFill).not.toBe('transparent')
    expect(flatGlass.surfaceBlur).toContain('blur')
  })

  it('is solid and invisible by default', () => {
    const solid = resolveAppearance({})
    expect(solid.material).toBe('solid')
    expect(solid.surfaceFill).toBe('transparent')
    expect(solid.surfaceBlur).toBe('none')
  })

  it('leaves an inset that is safe to append to any shadow list', () => {
    // `box-shadow: none, ...` is invalid, so solid contributes a no-op instead.
    expect(resolveAppearance({}).surfaceInset).not.toBe('none')
  })
})

describe('the three families', () => {
  const config: InviteConfig = { customFonts: { title: { family: 'Script' }, body: { family: 'Mono' } } }

  it('gives the small display type to the title face', () => {
    // Title, and the lines that belong with it: kickers and captions.
    const { recipes } = resolveAppearance(config)
    expect(recipes.title.family).toBe('Script')
    expect(recipes.eyebrow.family).toBe('Script')
    expect(recipes.caption.family).toBe('Script')
  })

  it('gives running text to the body face', () => {
    const { recipes } = resolveAppearance(config)
    expect(recipes.body.family).toBe('Mono')
    expect(recipes.data.family).toBe('Mono')
  })

  it('lets a heading follow the headline until a host says otherwise', () => {
    // Falling back to body is what turned a script "Forever Us" monospaced on
    // a page that had never chosen a header font.
    expect(resolveAppearance(config).recipes.header.family).toBe('Script')
    const chosen: InviteConfig = { customFonts: { ...config.customFonts, header: { family: 'Slab' } } }
    expect(resolveAppearance(chosen).recipes.header.family).toBe('Slab')
  })

  it('reads the version 1 spelling for all three', () => {
    const v1: InviteConfig = { customFonts: { titleFont: 'Script', bodyFont: 'Mono' } }
    const { recipes } = resolveAppearance(v1)
    expect([recipes.title.family, recipes.header.family, recipes.body.family]).toEqual(['Script', 'Script', 'Mono'])
  })
})

describe('ink follows the same three parts as family', () => {
  it('moves exactly what the matching font control moves', () => {
    // Two rows of three controls in the editor. Slot one of Colours has to act
    // on slot one of Fonts, or the pairing is a lie.
    const config: InviteConfig = {
      customColors: { titleColor: '#AA0000', headerColor: '#00AA00', fontColor: '#0000AA' },
    }
    const { recipes } = resolveAppearance(config)
    expect([recipes.title.color, recipes.eyebrow.color, recipes.caption.color]).toEqual([
      '#AA0000', '#AA0000', '#AA0000',
    ])
    expect(recipes.header.color).toBe('#00AA00')
    expect([recipes.body.color, recipes.data.color]).toEqual(['#0000AA', '#0000AA'])
  })

  it('falls back the way the families do', () => {
    // Heading follows headline; headline follows the page's main ink.
    const { recipes } = resolveAppearance({ customColors: { fontColor: '#123456' } })
    expect(recipes.title.color).toBe('#123456')
    expect(recipes.header.color).toBe('#123456')

    const withTitle = resolveAppearance({ customColors: { fontColor: '#123456', titleColor: '#ABCDEF' } })
    expect(withTitle.recipes.header.color).toBe('#ABCDEF')
  })
})
