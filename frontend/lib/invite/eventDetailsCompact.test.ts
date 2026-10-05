/**
 * Unit tests for the Event Details compact layout — each row appears only
 * when its field is filled in, and times read the way a person says them.
 */

import { describe, expect, it } from 'vitest'
import { buildCompactRows, formatCompactDate, formatTimeRange } from './eventDetailsCompact'

const october = new Date('2026-10-10T12:00:00Z')

describe('formatTimeRange', () => {
  it('prints the meridiem and zone once when both ends share them', () => {
    expect(formatTimeRange('10:00', '11:00', 'America/New_York', october)).toBe('10:00–11:00 AM EDT')
  })

  it('keeps both meridiems when the range crosses noon', () => {
    expect(formatTimeRange('11:30', '13:00', 'America/New_York', october)).toBe('11:30 AM–1:00 PM EDT')
  })

  it('is just the start time when there is no end, or the end is unreadable', () => {
    expect(formatTimeRange('10:00', undefined, 'America/New_York', october)).toBe('10:00 AM EDT')
    expect(formatTimeRange('10:00', 'soon', undefined)).toBe('10:00 AM')
  })

  it('omits the zone rather than guessing when the event has none', () => {
    expect(formatTimeRange('10:00', '11:00')).toBe('10:00–11:00 AM')
  })
})

describe('formatCompactDate', () => {
  it('uses the short weekday and month', () => {
    expect(formatCompactDate('2026-10-10')).toBe('Sat, Oct 10, 2026')
  })

  it('hands back text it cannot read instead of "Invalid Date"', () => {
    expect(formatCompactDate('next week')).toBe('next week')
  })
})

describe('buildCompactRows', () => {
  it('turns a repeating class into When / Starts / Where', () => {
    expect(
      buildCompactRows(
        { date: '2026-10-10', time: '10:00', endTime: '11:00', repeats: 'Saturdays', location: 'Online · Zoom 💻' },
        'America/New_York',
        october,
      ),
    ).toEqual([
      { label: 'When', value: 'Saturdays · 10:00–11:00 AM EDT' },
      { label: 'Starts', value: 'Sat, Oct 10, 2026' },
      { label: 'Where', value: 'Online · Zoom 💻' },
    ])
  })

  it('uses Date / Time for a one-off event', () => {
    expect(buildCompactRows({ date: '2026-10-10', time: '18:30', location: 'The Grand Hall' })).toEqual([
      { label: 'Date', value: 'Sat, Oct 10, 2026' },
      { label: 'Time', value: '6:30 PM' },
      { label: 'Where', value: 'The Grand Hall' },
    ])
  })

  it('shows no row for an empty field', () => {
    expect(buildCompactRows({ date: '2026-10-10', location: '  ' })).toEqual([
      { label: 'Date', value: 'Sat, Oct 10, 2026' },
    ])
  })

  it('shows the repeat on its own when there is no time', () => {
    expect(buildCompactRows({ date: '', repeats: 'Every weekend', location: '' })).toEqual([
      { label: 'When', value: 'Every weekend' },
    ])
  })

  it('adds Good to know after Where, in the host order, linking only safe links', () => {
    const rows = buildCompactRows({
      date: '2026-10-10',
      location: 'Hall',
      goodToKnow: [
        { id: '1', kind: 'stay', text: 'Rooms at the Taj', url: 'booking.com/taj' },
        { id: '2', kind: 'dress', text: '  ' },
        { id: '3', kind: 'dress', text: 'Festive', url: 'javascript:alert(1)' },
      ],
    })
    expect(rows.slice(2)).toEqual([
      { label: 'Stay', value: 'Rooms at the Taj', href: 'https://booking.com/taj' },
      { label: 'Dress code', value: 'Festive' },
    ])
  })

  it('ignores an end time that has no start time', () => {
    expect(buildCompactRows({ date: '2026-10-10', endTime: '11:00', location: '' })).toEqual([
      { label: 'Date', value: 'Sat, Oct 10, 2026' },
    ])
  })
})
