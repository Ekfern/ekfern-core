/**
 * Unit tests for Letter Balloons — the tap boundary and the layout invariants
 * that keep the reading column clear.
 */

import { describe, expect, it } from 'vitest'
import {
  BALLOON_LETTERS,
  INTERACTIVE_SELECTOR,
  buildBalloons,
  isInteractiveTarget,
  isPointInBalloon,
} from './letterBalloons'

/** Stand-in for a DOM element: `closest` matches when the element is inside one of `ancestors`. */
function fakeTarget(ancestors: string[]) {
  return {
    closest: (selector: string) => {
      const wanted = selector.split(',').map((s) => s.trim())
      return ancestors.some((a) => wanted.includes(a)) ? {} : null
    },
  }
}

describe('isInteractiveTarget', () => {
  it('treats links, buttons and form fields as taps the balloons must not take', () => {
    for (const tag of ['a', 'button', 'input', 'textarea', 'select', 'label']) {
      expect(isInteractiveTarget(fakeTarget([tag]))).toBe(true)
    }
    expect(isInteractiveTarget(fakeTarget(['[role="button"]']))).toBe(true)
  })

  it('lets taps on plain text and open space reach the balloons', () => {
    expect(isInteractiveTarget(fakeTarget(['p', 'div']))).toBe(false)
  })

  it('ignores targets that are not elements', () => {
    expect(isInteractiveTarget(null)).toBe(false)
    expect(isInteractiveTarget(undefined)).toBe(false)
    expect(isInteractiveTarget({})).toBe(false)
  })

  it('covers every native control a guest can tap', () => {
    for (const tag of ['a', 'button', 'input', 'textarea', 'select']) {
      expect(INTERACTIVE_SELECTOR.split(',').map((s) => s.trim())).toContain(tag)
    }
  })
})

describe('isPointInBalloon', () => {
  const rect = { left: 100, top: 200, width: 60, height: 104 }

  it('hits the middle of the balloon body', () => {
    expect(isPointInBalloon(130, 236, rect)).toBe(true)
  })

  it('misses the string hanging below the body', () => {
    expect(isPointInBalloon(130, 295, rect)).toBe(false)
  })

  it('misses points beside the balloon', () => {
    expect(isPointInBalloon(60, 236, rect)).toBe(false)
    expect(isPointInBalloon(200, 236, rect)).toBe(false)
  })

  it('never hits an unmeasured balloon', () => {
    expect(isPointInBalloon(0, 0, { left: 0, top: 0, width: 0, height: 0 })).toBe(false)
  })
})

describe('buildBalloons', () => {
  it('is deterministic so server and client render the same balloons', () => {
    expect(buildBalloons(14)).toEqual(buildBalloons(14))
  })

  it('keeps most balloons at the edges and makes the middle ones smaller', () => {
    const balloons = buildBalloons(14)
    const center = balloons.filter((b) => b.center)
    expect(center.length).toBeLessThanOrEqual(balloons.length / 3)
    for (const b of center) {
      expect(b.size).toBeLessThanOrEqual(42)
      expect(b.left).toBeGreaterThanOrEqual(34)
      expect(b.left).toBeLessThanOrEqual(60)
    }
    for (const b of balloons.filter((x) => !x.center)) {
      expect(b.left < 20 || b.left >= 80).toBe(true)
    }
  })

  it('uses every letter once before repeating', () => {
    const letters = buildBalloons(BALLOON_LETTERS.length).map((b) => b.letter)
    expect(new Set(letters).size).toBe(BALLOON_LETTERS.length)
  })
})
