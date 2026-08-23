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
