/**
 * Reading the saved session must never crash a page, even when the browser
 * blocks site data.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { storedAccessToken } from './api'

function withLocalStorage(getter: () => Pick<Storage, 'getItem'>) {
  vi.stubGlobal('window', Object.defineProperty({}, 'localStorage', { get: getter }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('storedAccessToken', () => {
  it('returns the saved token', () => {
    withLocalStorage(() => ({ getItem: (k: string) => (k === 'access_token' ? 'abc' : null) }))
    expect(storedAccessToken()).toBe('abc')
  })

  it('is null when nothing is saved', () => {
    withLocalStorage(() => ({ getItem: () => null }))
    expect(storedAccessToken()).toBeNull()
  })

  it('is null instead of throwing when the browser blocks storage', () => {
    withLocalStorage(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(storedAccessToken()).toBeNull()
  })

  it('is null on the server, where there is no window', () => {
    expect(storedAccessToken()).toBeNull()
  })
})
