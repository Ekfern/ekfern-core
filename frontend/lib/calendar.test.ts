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

/** Unfolds first (RFC 5545: CRLF + one space), so assertions see whole values. */
const lineOf = (ics: string, prop: string) =>
  ics
    .replace(/\r\n /g, '')
    .split('\r\n')
    .find((l) => l.startsWith(`${prop}:`))

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

  it('reuses the caller\'s uid, so a second download updates rather than duplicates', () => {
    const first = generateICS({ ...base, uid: 'meera-arjun@example.com' })
    const second = generateICS({ ...base, uid: 'meera-arjun@example.com' })
    expect(lineOf(first, 'UID')).toBe('UID:meera-arjun@example.com')
    expect(lineOf(second, 'UID')).toBe(lineOf(first, 'UID'))
  })

  it('falls back to a unique uid when the caller has no stable identity', () => {
    const a = lineOf(generateICS(base), 'UID')
    const b = lineOf(generateICS(base), 'UID')
    expect(a).toBeDefined()
    expect(a).not.toBe(b)
  })

  it('carries the sequence so a calendar can tell a newer copy from the one it holds', () => {
    expect(lineOf(generateICS({ ...base, uid: 'x@y', sequence: 29_700_123 }), 'SEQUENCE'))
      .toBe('SEQUENCE:29700123')
  })

  it('defaults the sequence to zero and never emits a negative or fractional one', () => {
    expect(lineOf(generateICS(base), 'SEQUENCE')).toBe('SEQUENCE:0')
    expect(lineOf(generateICS({ ...base, sequence: -5 }), 'SEQUENCE')).toBe('SEQUENCE:0')
    expect(lineOf(generateICS({ ...base, sequence: 12.9 }), 'SEQUENCE')).toBe('SEQUENCE:12')
    expect(lineOf(generateICS({ ...base, sequence: NaN }), 'SEQUENCE')).toBe('SEQUENCE:0')
  })

  it('folds content lines at 75 octets, as the spec requires', () => {
    const url = 'https://invitations.example.com/invite/meera-and-arjun-wedding-december-2027'
    const ics = generateICS({ ...base, url })
    const octets = (l: string) => new TextEncoder().encode(l).length
    expect(ics.split('\r\n').filter((l) => octets(l) > 75)).toEqual([])
  })

  it('folds so that unfolding restores the original value', () => {
    const url = 'https://invitations.example.com/invite/meera-and-arjun-wedding-december-2027'
    const ics = generateICS({ ...base, url })
    // Unfolding per RFC 5545: drop CRLF followed by a single space.
    const unfolded = ics.replace(/\r\n /g, '')
    expect(lineOf(unfolded, 'URL')).toBe(`URL:${url}`)
  })

  it('never splits a multi-byte character across a fold', () => {
    const ics = generateICS({ ...base, url: undefined, details: 'सुखकर्ता दुःखहर्ता '.repeat(12) })
    for (const line of ics.split('\r\n')) {
      // A cut mid-character would leave an unpaired surrogate or a lone
      // continuation byte; round-tripping through UTF-8 exposes either.
      const encoder = new TextEncoder()
      const decoder = new TextDecoder('utf-8', { fatal: true })
      expect(() => decoder.decode(encoder.encode(line))).not.toThrow()
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
  })

  it('leaves short lines untouched', () => {
    const ics = generateICS({
      title: 'Bare',
      startISO: base.startISO,
      endISO: base.endISO,
    })
    expect(ics).toContain('\r\nSUMMARY:Bare\r\n')
    expect(ics).not.toContain('\r\n ')
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

describe('a repeating series', () => {
  // 2 am on Saturday in India is still Friday in UTC, so a weekly rule written
  // in UTC would land on Fridays. Series times are written on the venue clock.
  const series = {
    title: 'Satsang',
    startISO: '2026-10-09T20:30:00.000Z', // Sat 10 Oct, 02:00 IST
    endISO: '2026-10-10T00:30:00.000Z',
    series: { rrule: 'FREQ=WEEKLY;BYDAY=SA;UNTIL=20261128', skipped: ['2026-10-17'], timeZone: 'Asia/Kolkata' },
  }

  it('writes the start on the venue clock, with the rule and skipped dates', () => {
    const ics = generateICS(series)
    expect(ics).toContain('DTSTART;TZID=Asia/Kolkata:20261010T020000')
    expect(ics).toContain('DTEND;TZID=Asia/Kolkata:20261010T060000')
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=SA;UNTIL=20261128T235959Z')
    expect(ics).toContain('EXDATE;TZID=Asia/Kolkata:20261017T020000')
    expect(ics).not.toMatch(/^DTSTART:/m)
  })

  it('tells Google the rule and the zone', () => {
    const href = new URL(getGoogleCalendarHref(series))
    expect(href.searchParams.get('dates')).toBe('20261010T020000/20261010T060000')
    expect(href.searchParams.get('ctz')).toBe('Asia/Kolkata')
    expect(href.searchParams.get('recur')).toBe('RRULE:FREQ=WEEKLY;BYDAY=SA;UNTIL=20261128T235959Z')
  })

  it('leaves a one-off event in UTC as before', () => {
    const { series: _ignored, ...oneOff } = series
    expect(generateICS(oneOff)).toContain('DTSTART:20261009T203000Z')
  })
})
