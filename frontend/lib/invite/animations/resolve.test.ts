/**
 * Unit tests for resolveAnimations — legacy envelope, scalars, and arrays.
 */

import { describe, expect, it } from 'vitest'
import { clampAnimationSlot, resolveAnimations } from './resolve'
import { primaryAnimationId } from './types'

describe('resolveAnimations', () => {
  it('defaults opening to envelope_reveal when animations is missing', () => {
    expect(resolveAnimations(null)).toEqual({
      opening: ['envelope_reveal'],
      experience: [],
    })
    expect(resolveAnimations(undefined)).toEqual({
      opening: ['envelope_reveal'],
      experience: [],
    })
  })

  it('maps legacy envelope true / omitted to envelope_reveal', () => {
    expect(resolveAnimations({ envelope: true })).toEqual({
      opening: ['envelope_reveal'],
      experience: [],
    })
    expect(resolveAnimations({})).toEqual({
      opening: ['envelope_reveal'],
      experience: [],
    })
  })

  it('maps legacy envelope false to no opening', () => {
    expect(resolveAnimations({ envelope: false })).toEqual({
      opening: [],
      experience: [],
    })
  })

  it('prefers explicit opening over envelope boolean', () => {
    expect(resolveAnimations({ opening: null, envelope: true })).toEqual({
      opening: [],
      experience: [],
    })
    expect(
      resolveAnimations({ opening: 'envelope_reveal', envelope: false }),
    ).toEqual({
      opening: ['envelope_reveal'],
      experience: [],
    })
  })

  it('resolves known experience ids and ignores unknown', () => {
    expect(resolveAnimations({ opening: null, experience: 'rose_petals' })).toEqual({
      opening: [],
      experience: ['rose_petals'],
    })
    expect(resolveAnimations({ opening: null, experience: 'chinese_lanterns' })).toEqual({
      opening: [],
      experience: ['chinese_lanterns'],
    })
    expect(resolveAnimations({ opening: null, experience: 'balloons' })).toEqual({
      opening: [],
      experience: [],
    })
  })

  it('resolves known curtain_reveal opening id', () => {
    expect(resolveAnimations({ opening: 'curtain_reveal' })).toEqual({
      opening: ['curtain_reveal'],
      experience: [],
    })
  })

  it('ignores unknown opening ids', () => {
    expect(resolveAnimations({ opening: 'curtain' })).toEqual({
      opening: [],
      experience: [],
    })
  })

  it('normalizes arrays and drops unknown entries', () => {
    expect(
      resolveAnimations({
        opening: ['curtain_reveal', 'nope'],
        experience: ['rose_petals'],
      }),
    ).toEqual({
      opening: ['curtain_reveal'],
      experience: ['rose_petals'],
    })
  })

  it('treats empty array as none', () => {
    expect(resolveAnimations({ opening: [], experience: [] })).toEqual({
      opening: [],
      experience: [],
    })
  })
})

describe('primaryAnimationId / clampAnimationSlot', () => {
  it('returns first id or null', () => {
    expect(primaryAnimationId(['a', 'b'])).toBe('a')
    expect(primaryAnimationId([])).toBe(null)
    expect(primaryAnimationId(null)).toBe(null)
  })

  it('clamps to max one by default', () => {
    expect(clampAnimationSlot(['a', 'b'])).toEqual(['a'])
    expect(clampAnimationSlot([])).toEqual([])
  })
})
