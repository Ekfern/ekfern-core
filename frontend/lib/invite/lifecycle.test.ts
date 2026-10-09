import { describe, expect, it } from 'vitest'
import { closingLabel, daysBetween, guestRibbon, hostBadge, isPast, lifecycleRefusal, nextDateLabel, todayInZone, type Lifecycle } from './lifecycle'

const base: Lifecycle = {
  phase: 'upcoming',
  timezone: 'Asia/Kolkata',
  ends_at: null,
  rsvp_open: true,
  catalog_open: true,
  catalog_closes_at: null,
  catalog_closed_early: false,
  link_off_at: null,
  cancelled_note: '',
  series: null,
}

describe('closingLabel', () => {
  // Gifts close at the start of 8 Dec in India: the last open minute is 7 Dec, 11:59 pm.
  const closes = '2026-12-07T18:30:00+00:00'

  it('names the last open minute in the event zone', () => {
    expect(closingLabel(closes, 'Asia/Kolkata', 'Asia/Kolkata')).toBe('Mon 7 Dec, 11:59 pm IST')
  })

  it('adds the guest’s own clock when they are elsewhere', () => {
    expect(closingLabel(closes, 'Asia/Kolkata', 'America/New_York')).toBe('Mon 7 Dec, 11:59 pm IST (1:29 pm your time)')
  })

  it('says nothing for no moment', () => {
    expect(closingLabel(null, 'Asia/Kolkata')).toBe('')
  })
})

describe('guestRibbon', () => {
  it('is silent while the event is upcoming or happening', () => {
    expect(guestRibbon(base)).toBeNull()
    expect(guestRibbon({ ...base, phase: 'happening' })).toBeNull()
  })

  it('says the celebration has ended, or the series', () => {
    expect(guestRibbon({ ...base, phase: 'ended' })?.text).toBe('This celebration has ended')
    expect(guestRibbon({ ...base, phase: 'ended', series: { rrule: 'FREQ=WEEKLY', skipped: [], next_date: null, today: false } })?.text)
      .toBe('This series has ended')
  })

  it('carries the host’s note on a cancellation', () => {
    expect(guestRibbon({ ...base, phase: 'cancelled', cancelled_note: 'Moving to spring' }))
      .toEqual({ text: 'This event has been cancelled', note: 'Moving to spring' })
  })
})

describe('lifecycleRefusal', () => {
  it('reads the code the backend refuses with', () => {
    const error = { response: { data: { code: 'RSVP_CLOSED', lifecycle: { ...base, phase: 'ended' } } } }
    expect(lifecycleRefusal(error)?.code).toBe('RSVP_CLOSED')
  })

  it('ignores every other error', () => {
    expect(lifecycleRefusal({ response: { data: { error: 'Phone is required' } } })).toBeNull()
    expect(lifecycleRefusal(new Error('network'))).toBeNull()
  })
})

describe('nextDateLabel', () => {
  it('reads a plain date without shifting it by the reader’s zone', () => {
    expect(nextDateLabel('2026-10-12')).toBe('Mon 12 Oct')
  })
})

describe('hostBadge', () => {
  it('names the last day an event ran, in its own zone', () => {
    expect(hostBadge({ ...base, phase: 'ended', ends_at: '2026-10-04T00:00:00+05:30' })).toBe('Ended 3 Oct')
  })

  it('has a word for every phase', () => {
    expect(hostBadge({ ...base, phase: 'cancelled' })).toBe('Cancelled')
    expect(hostBadge({ ...base, phase: 'archived', link_off_at: '2026-11-03T00:00:00+05:30' })).toBe('Link off since 3 Nov')
    expect(hostBadge({ ...base, phase: 'ongoing' })).toBe('Ongoing series')
    expect(hostBadge(base)).toBe('Upcoming')
  })
})

describe('isPast', () => {
  it('files ended, cancelled and closed-link events as past', () => {
    expect(['ended', 'cancelled', 'archived'].map((phase) => isPast({ ...base, phase: phase as Lifecycle['phase'] }))).toEqual([true, true, true])
    expect(isPast({ ...base, phase: 'ongoing' })).toBe(false)
  })
})

describe('todayInZone', () => {
  // 20:00 in Chicago on 8 Oct is already 9 Oct in India.
  const now = new Date('2026-10-09T01:00:00Z')

  it('is the event’s calendar day, not the reader’s', () => {
    expect(todayInZone('Asia/Kolkata', now)).toBe('2026-10-09')
    expect(todayInZone('America/Chicago', now)).toBe('2026-10-08')
  })

  it('counts whole days between plain dates', () => {
    expect(daysBetween('2026-10-09', '2026-10-10')).toBe(1)
    expect(daysBetween('2026-10-09', '2026-03-29')).toBe(-194)
  })
})
