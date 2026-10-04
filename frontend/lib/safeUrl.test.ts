import { describe, expect, it } from 'vitest'
import { safeExternalUrl } from './safeUrl'

describe('safeExternalUrl', () => {
  it('keeps http and https links', () => {
    expect(safeExternalUrl('https://booking.com/hotel?x=1')).toBe('https://booking.com/hotel?x=1')
    expect(safeExternalUrl('http://example.com')).toBe('http://example.com/')
  })

  it('reads a bare domain the way people paste it', () => {
    expect(safeExternalUrl('  booking.com/hotel ')).toBe('https://booking.com/hotel')
    expect(safeExternalUrl('wa.me/919800000000')).toBe('https://wa.me/919800000000')
  })

  it('refuses anything that would run or embed instead of link', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('JavaScript:alert(1)')).toBeNull()
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(safeExternalUrl('vbscript:msgbox')).toBeNull()
  })

  it('refuses text that is not a link at all', () => {
    expect(safeExternalUrl('')).toBeNull()
    expect(safeExternalUrl(undefined)).toBeNull()
    expect(safeExternalUrl('call Rohan')).toBeNull()
    expect(safeExternalUrl('https://hello')).toBeNull()
  })
})
