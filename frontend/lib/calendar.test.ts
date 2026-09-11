import { describe, it, expect } from 'vitest'
import { generateICS, getGoogleCalendarHref, type CalendarEvent } from './calendar'

const base: CalendarEvent = {
  title: 'Meera & Arjun',
  location: 'The Geraghty, Chicago',
  url: 'https://example.com/invite/meera-arjun',
  // 7:30 PM CST on 15 Jan 2027.
  startISO: '2027-01-16T01:30:00.000Z',
  endISO: '2027-01-16T05:30:00.000Z',
}

const lineOf = (ics: string, prop: string) =>
  ics.split('\r\n').find((l) => l.startsWith(`${prop}:`))

describe('generateICS', () => {
  it('writes the instant in UTC so the guest calendar renders it locally', () => {
    const ics = generateICS(base)
    expect(lineOf(ics, 'DTSTART')).toBe('DTSTART:20270116T013000Z')
    expect(lineOf(ics, 'DTEND')).toBe('DTEND:20270116T053000Z')
  })

  it('carries the venue', () => {
    // Commas are escaped: ICS treats them as value separators.
    expect(lineOf(generateICS(base), 'LOCATION')).toBe('LOCATION:The Geraghty\\, Chicago')
  })

  it('carries the invite link as a URL property', () => {
    expect(lineOf(generateICS(base), 'URL')).toBe('URL:https://example.com/invite/meera-arjun')
  })

  it('leaves the link unescaped, since URL is a URI value and not text', () => {
    const ics = generateICS({ ...base, url: 'https://example.com/invite/a,b;c' })
    expect(lineOf(ics, 'URL')).toBe('URL:https://example.com/invite/a,b;c')
  })

  it('repeats the link in the description, for clients that ignore URL', () => {
    expect(lineOf(generateICS(base), 'DESCRIPTION'))
      .toBe('DESCRIPTION:https://example.com/invite/meera-arjun')
  })

  it('puts the host copy above the link when there is both', () => {
    const ics = generateICS({ ...base, details: 'Dinner follows the ceremony.' })
    expect(lineOf(ics, 'DESCRIPTION'))
      .toBe('DESCRIPTION:Dinner follows the ceremony.\\n\\nhttps://example.com/invite/meera-arjun')
  })

  it('omits the optional properties rather than emitting empty ones', () => {
    const ics = generateICS({
      title: 'Bare',
      startISO: base.startISO,
      endISO: base.endISO,
    })
    expect(lineOf(ics, 'URL')).toBeUndefined()
    expect(lineOf(ics, 'DESCRIPTION')).toBeUndefined()
    expect(lineOf(ics, 'LOCATION')).toBeUndefined()
    expect(lineOf(ics, 'SUMMARY')).toBe('SUMMARY:Bare')
  })

  it('produces a well-formed, CRLF-delimited calendar', () => {
    const ics = generateICS(base)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR')).toBe(true)
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VEVENT')
  })
})

describe('getGoogleCalendarHref', () => {
  it('sends the same instant Google expects', () => {
    const url = new URL(getGoogleCalendarHref(base))
    expect(url.searchParams.get('dates')).toBe('20270116T013000Z/20270116T053000Z')
  })

  it('carries title and venue', () => {
    const url = new URL(getGoogleCalendarHref(base))
    expect(url.searchParams.get('text')).toBe('Meera & Arjun')
    expect(url.searchParams.get('location')).toBe('The Geraghty, Chicago')
  })

  it('puts the link in details, since the template URL has no link parameter', () => {
    const url = new URL(getGoogleCalendarHref(base))
    expect(url.searchParams.get('details')).toBe('https://example.com/invite/meera-arjun')
  })

  it('keeps host copy and link together, in that order', () => {
    const url = new URL(getGoogleCalendarHref({ ...base, details: 'Black tie.' }))
    expect(url.searchParams.get('details'))
      .toBe('Black tie.\n\nhttps://example.com/invite/meera-arjun')
  })

  it('omits details entirely when there is neither', () => {
    const url = new URL(getGoogleCalendarHref({
      title: 'Bare',
      startISO: base.startISO,
      endISO: base.endISO,
    }))
    expect(url.searchParams.get('details')).toBeNull()
  })
})
