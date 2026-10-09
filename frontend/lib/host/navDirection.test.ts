import { describe, expect, it } from 'vitest'
import { navDirection } from './navDirection'

describe('navDirection', () => {
  it('slides forward when going deeper', () => {
    expect(navDirection('/host/dashboard', '/host/events/52')).toBe('forward')
    expect(navDirection('/host/events/52', '/host/events/52/details')).toBe('forward')
    expect(navDirection('/host/events/52/guests', '/host/events/52/sub-events-setup')).toBe('forward')
  })

  it('slides back when coming out', () => {
    expect(navDirection('/host/events/52/details', '/host/events/52')).toBe('back')
    expect(navDirection('/host/events/52/rsvp', '/host/dashboard')).toBe('back')
  })

  it('fades between an event’s tabs, which sit side by side', () => {
    expect(navDirection('/host/events/52', '/host/events/52/guests')).toBe('tab')
    expect(navDirection('/host/events/52/guests', '/host/events/52/rsvp?x=1')).toBe('tab')
    expect(navDirection('/host/events/52/catalog', '/host/events/52/page-editor')).toBe('tab')
  })

  it('treats a first page with nothing before it as a fade', () => {
    expect(navDirection(null, '/host/events/52')).toBe('tab')
  })
})
