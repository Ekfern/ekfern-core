import { describe, expect, it } from 'vitest'
import { INVITE_LAYER } from './layers'

/**
 * The card's parts in physical order: paper, what is printed on it, its edge,
 * then the air in front of it. Tiles sit at 0, unpositioned, so the paper's
 * layers must stay negative and everything above them positive.
 */
describe('INVITE_LAYER', () => {
  it('stacks paper < ornament < content < frame < border < air', () => {
    const content = 0
    const order = [
      INVITE_LAYER.paperTexture,
      INVITE_LAYER.ornament,
      content,
      INVITE_LAYER.frame,
      INVITE_LAYER.border,
      INVITE_LAYER.air,
    ]
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(new Set(order).size).toBe(order.length)
  })
})
