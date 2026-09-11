/**
 * Unit tests for resolveAnimations — legacy envelope boolean + new IDs.
 */

import { describe, expect, it } from 'vitest'
import { resolveAnimations } from './resolve'

describe('resolveAnimations', () => {
  it('defaults opening to envelope_reveal when animations is missing', () => {
    expect(resolveAnimations(null)).toEqual({
      opening: 'envelope_reveal',
      experience: null,
    })
    expect(resolveAnimations(undefined)).toEqual({
      opening: 'envelope_reveal',
      experience: null,
    })
  })

  it('maps legacy envelope true / omitted to envelope_reveal', () => {
    expect(resolveAnimations({ envelope: true })).toEqual({
      opening: 'envelope_reveal',
      experience: null,
    })
    expect(resolveAnimations({})).toEqual({
      opening: 'envelope_reveal',
      experience: null,
    })
  })

  it('maps legacy envelope false to no opening', () => {
    expect(resolveAnimations({ envelope: false })).toEqual({
      opening: null,
      experience: null,
    })
  })

  it('prefers explicit opening over envelope boolean', () => {
    expect(resolveAnimations({ opening: null, envelope: true })).toEqual({
      opening: null,
      experience: null,
    })
    expect(
      resolveAnimations({ opening: 'envelope_reveal', envelope: false }),
    ).toEqual({
      opening: 'envelope_reveal',
      experience: null,
    })
  })

  it('resolves known experience ids and ignores unknown', () => {
    expect(resolveAnimations({ opening: null, experience: 'rose_petals' })).toEqual({
      opening: null,
      experience: 'rose_petals',
    })
    expect(resolveAnimations({ opening: null, experience: 'balloons' })).toEqual({
      opening: null,
      experience: null,
    })
  })

  it('resolves known curtain_reveal opening id', () => {
    expect(resolveAnimations({ opening: 'curtain_reveal' })).toEqual({
      opening: 'curtain_reveal',
      experience: null,
    })
  })

  it('ignores unknown opening ids', () => {
    expect(resolveAnimations({ opening: 'curtain' })).toEqual({
      opening: null,
      experience: null,
    })
  })
})
