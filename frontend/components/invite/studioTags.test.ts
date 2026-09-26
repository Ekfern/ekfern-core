import { describe, it, expect } from 'vitest'
import { mergeTags, normalizeTag, MAX_LAYOUT_TAGS } from './StudioTagsInput'

describe('normalizeTag', () => {
  it('lowercases, trims and collapses whitespace like the API does', () => {
    expect(normalizeTag('  Garden   Party ')).toBe('garden party')
  })

  it('truncates to the API limit', () => {
    expect(normalizeTag('x'.repeat(60))).toHaveLength(40)
  })
})

describe('mergeTags', () => {
  it('keeps every tag from a pasted comma-separated list', () => {
    // Regression: committing one tag at a time read a stale list, so a paste of
    // "a, b, c" kept only the last tag and silently lost the rest.
    expect(mergeTags([], ['Garden Party', ' Evening', ' Formal Dress'])).toEqual([
      'garden party',
      'evening',
      'formal dress',
    ])
  })

  it('appends to existing tags without dropping them', () => {
    expect(mergeTags(['wedding'], ['floral', 'floral'])).toEqual(['wedding', 'floral'])
  })

  it('skips blanks and duplicates, ignoring case', () => {
    expect(mergeTags(['wedding'], ['', '   ', 'WEDDING'])).toEqual(['wedding'])
  })

  it('stops at the tag limit', () => {
    const existing = Array.from({ length: MAX_LAYOUT_TAGS }, (_, i) => `tag-${i}`)
    expect(mergeTags(existing, ['one-too-many'])).toEqual(existing)
  })
})
