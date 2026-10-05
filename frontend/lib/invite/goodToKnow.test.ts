import { describe, expect, it } from 'vitest'
import { chipOrder, remainingKinds, visibleItems } from './goodToKnow'
import type { GoodToKnowItem } from './schema'

const item = (kind: GoodToKnowItem['kind'], text = ''): GoodToKnowItem => ({ id: `gtk-${kind}`, kind, text })

describe('chipOrder', () => {
  it('puts what wedding guests ask first', () => {
    expect(chipOrder('wedding').slice(0, 2)).toEqual(['dress', 'stay'])
  })

  it('follows the event type’s group, so all 58 types are covered', () => {
    expect(chipOrder('offsite')[0]).toBe('parking') // Professional & Business
    expect(chipOrder('potluck')[0]).toBe('food') // Food & Dining
    expect(chipOrder('satsang')[0]).toBe('dress') // Religious & Ceremonial
  })

  it('falls back to Other for an unknown or missing type', () => {
    expect(chipOrder('not-a-type')).toEqual(chipOrder('other'))
    expect(chipOrder(undefined)).toEqual(chipOrder('other'))
  })

  it('always offers all five kinds', () => {
    for (const type of ['wedding', 'offsite', 'potluck', 'concert', 'festival', 'puja', 'other']) {
      expect([...chipOrder(type)].sort()).toEqual(['contact', 'dress', 'food', 'parking', 'stay'])
    }
  })
})

describe('remainingKinds', () => {
  it('drops a kind once it has been added, filled in or not', () => {
    expect(remainingKinds([item('dress'), item('stay', 'Taj')], 'wedding')).toEqual(['contact', 'parking', 'food'])
  })
})

describe('visibleItems', () => {
  it('shows guests only items with words in them, in the host’s order', () => {
    expect(visibleItems([item('food', 'Dinner at 8'), item('dress', '   '), item('stay', 'Taj')]).map((i) => i.kind))
      .toEqual(['food', 'stay'])
  })

  it('copes with a tile that has no items yet', () => {
    expect(visibleItems(undefined)).toEqual([])
  })
})
