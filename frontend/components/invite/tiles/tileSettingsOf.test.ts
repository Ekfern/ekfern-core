import { describe, it, expect } from 'vitest'
import { tileSettingsOf } from './tileSettingsOf'

describe('tileSettingsOf', () => {
  it('returns an object when a tile has no settings', () => {
    // Regression: a title tile stored without settings crashed the whole page
    // editor, because every panel reads settings.<field> directly.
    expect(tileSettingsOf({ settings: undefined } as never)).toEqual({})
  })

  it('returns an object for a null or missing tile', () => {
    expect(tileSettingsOf(null)).toEqual({})
    expect(tileSettingsOf(undefined)).toEqual({})
  })

  it('passes real settings through untouched', () => {
    const settings = { text: 'You are invited', size: 42 }
    expect(tileSettingsOf({ settings } as never)).toBe(settings)
  })

  it('ignores a non-object settings value', () => {
    expect(tileSettingsOf({ settings: 'nonsense' } as never)).toEqual({})
  })
})
