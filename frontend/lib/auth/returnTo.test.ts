/**
 * Unit tests for the post-auth return path — only our own paths are followed.
 */

import { describe, expect, it } from 'vitest'
import { DEFAULT_AFTER_AUTH, afterAuthPath, loginPathReturningTo, safeReturnPath } from './returnTo'

const params = (next: string | null) => ({ get: (k: string) => (k === 'next' ? next : null) })

describe('safeReturnPath', () => {
  it('accepts a path on this site', () => {
    expect(safeReturnPath('/cohost-invite/13:abc:def')).toBe('/cohost-invite/13:abc:def')
  })

  it('refuses anything that could leave the site', () => {
    for (const bad of ['https://evil.test', '//evil.test/x', '/\\evil.test', 'javascript:alert(1)', 'evil.test', '/a\\b', '/x\u0000y']) {
      expect(safeReturnPath(bad)).toBeNull()
    }
  })

  it('ignores empty values', () => {
    expect(safeReturnPath('')).toBeNull()
    expect(safeReturnPath(null)).toBeNull()
  })
})

describe('afterAuthPath', () => {
  it('returns to the page that asked, or the dashboard', () => {
    expect(afterAuthPath(params('/cohost-invite/t'))).toBe('/cohost-invite/t')
    expect(afterAuthPath(params('https://evil.test'))).toBe(DEFAULT_AFTER_AUTH)
    expect(afterAuthPath(params(null))).toBe(DEFAULT_AFTER_AUTH)
  })
})

describe('loginPathReturningTo', () => {
  it('carries the current page along', () => {
    expect(loginPathReturningTo('/host/events/7/guests?tab=a')).toBe('/host/login?next=%2Fhost%2Fevents%2F7%2Fguests%3Ftab%3Da')
  })

  it('does not point login back at login or signup', () => {
    expect(loginPathReturningTo('/host/login?x=1')).toBe('/host/login')
    expect(loginPathReturningTo('/host/signup')).toBe('/host/login')
  })
})
