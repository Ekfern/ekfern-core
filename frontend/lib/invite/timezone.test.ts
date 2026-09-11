import { describe, it, expect } from 'vitest'
import { zonedTimeToUtc, getTimezoneLabel, formatEventTime } from './timezone'

/**
 * Every assertion here is an absolute instant or a zone-qualified label, so the
 * suite says the same thing on a laptop in Mumbai and a CI runner in UTC. That
 * is the point: the bug this file guards against was invisible to anyone
 * testing from the event's own timezone, because there the guest's clock and
 * the venue's clock agree by accident.
 */
describe('zonedTimeToUtc', () => {
  it('resolves a Chicago evening to the right moment on the guest, not the reader', () => {
    // 7:30 PM CST on 15 Jan 2027 is 01:30 UTC the next morning, which a
    // calendar in Mumbai renders as 7:00 AM on the 16th.
    const instant = zonedTimeToUtc('2027-01-15', '19:30', 'America/Chicago')
    expect(instant?.toISOString()).toBe('2027-01-16T01:30:00.000Z')

    const inMumbai = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(instant!)
    expect(inMumbai).toBe('16/01/2027, 07:00')
  })

  it('tracks daylight saving rather than assuming a fixed offset', () => {
    // Same wall clock, six months apart. Chicago is UTC-6 in January and
    // UTC-5 in July, so the instants differ by an hour.
    expect(zonedTimeToUtc('2027-01-15', '19:30', 'America/Chicago')?.toISOString())
      .toBe('2027-01-16T01:30:00.000Z')
    expect(zonedTimeToUtc('2027-07-15', '19:30', 'America/Chicago')?.toISOString())
      .toBe('2027-07-16T00:30:00.000Z')
  })

  it('lands on the correct side of a spring-forward boundary', () => {
    // US DST starts 03:00 on 14 Mar 2027; 01:00 is still CST, 03:00 is CDT.
    expect(zonedTimeToUtc('2027-03-14', '01:00', 'America/Chicago')?.toISOString())
      .toBe('2027-03-14T07:00:00.000Z')
    expect(zonedTimeToUtc('2027-03-14', '03:00', 'America/Chicago')?.toISOString())
      .toBe('2027-03-14T08:00:00.000Z')
  })

  it('handles a half-hour offset zone', () => {
    expect(zonedTimeToUtc('2027-01-15', '19:30', 'Asia/Kolkata')?.toISOString())
      .toBe('2027-01-15T14:00:00.000Z')
  })

  it('treats a missing time as midnight at the venue, not midnight UTC', () => {
    expect(zonedTimeToUtc('2027-01-15', undefined, 'America/Chicago')?.toISOString())
      .toBe('2027-01-15T06:00:00.000Z')
  })

  it('accepts a full ISO date string', () => {
    expect(zonedTimeToUtc('2027-01-15T00:00:00Z', '19:30', 'America/Chicago')?.toISOString())
      .toBe('2027-01-16T01:30:00.000Z')
  })

  it('returns null rather than guessing when it cannot know', () => {
    expect(zonedTimeToUtc('2027-01-15', '19:30', '')).toBeNull()
    expect(zonedTimeToUtc('', '19:30', 'America/Chicago')).toBeNull()
    expect(zonedTimeToUtc('2027-01-15', '19:30', 'Not/AZone')).toBeNull()
    expect(zonedTimeToUtc('not-a-date', '19:30', 'America/Chicago')).toBeNull()
  })
})

describe('getTimezoneLabel', () => {
  it('names the zone for the date, not for today', () => {
    const january = new Date('2027-01-15T12:00:00Z')
    const july = new Date('2027-07-15T12:00:00Z')
    expect(getTimezoneLabel('America/Chicago', january)).toBe('CST')
    expect(getTimezoneLabel('America/Chicago', july)).toBe('CDT')
  })

  it('covers the US zones the old hand-written map had no entry for', () => {
    const january = new Date('2027-01-15T12:00:00Z')
    expect(getTimezoneLabel('America/Denver', january)).toBe('MST')
    expect(getTimezoneLabel('America/Los_Angeles', january)).toBe('PST')
    expect(getTimezoneLabel('America/New_York', january)).toBe('EST')
  })

  it('keeps the local abbreviation where Intl would say GMT+5:30', () => {
    expect(getTimezoneLabel('Asia/Kolkata')).toBe('IST')
    expect(getTimezoneLabel('Asia/Dubai')).toBe('GST')
    expect(getTimezoneLabel('Asia/Singapore')).toBe('SGT')
  })

  it('falls back to the IANA name instead of inventing one', () => {
    expect(getTimezoneLabel('Not/AZone')).toBe('Not/AZone')
    expect(getTimezoneLabel('')).toBe('')
  })
})

describe('formatEventTime', () => {
  it('shows the venue wall clock, never a conversion', () => {
    const january = new Date('2027-01-15T12:00:00Z')
    expect(formatEventTime('19:30', 'America/Chicago', january)).toBe('7:30 PM CST')
    expect(formatEventTime('19:30', 'Asia/Kolkata', january)).toBe('7:30 PM IST')
  })

  it('omits the label rather than guessing when the zone is unknown', () => {
    expect(formatEventTime('19:30', undefined)).toBe('7:30 PM')
    expect(formatEventTime('19:30', '')).toBe('7:30 PM')
  })

  it('formats midnight and noon the way a person reads them', () => {
    expect(formatEventTime('00:00')).toBe('12:00 AM')
    expect(formatEventTime('12:00')).toBe('12:00 PM')
    expect(formatEventTime('09:05')).toBe('9:05 AM')
  })

  it('passes unparseable input through untouched', () => {
    expect(formatEventTime('evening')).toBe('evening')
  })
})
