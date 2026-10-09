import { describe, expect, it } from 'vitest'
import { nthOfMonth, rhythmLabel, specSummary, weekdayOf } from './recurrence'

describe('rhythmLabel', () => {
  it('says the rhythm the way people do', () => {
    expect(rhythmLabel('FREQ=WEEKLY;BYDAY=SU')).toBe('Every Sunday')
    expect(rhythmLabel('FREQ=WEEKLY;INTERVAL=2;BYDAY=SU;UNTIL=20261227')).toBe('Every other Sunday')
    expect(rhythmLabel('FREQ=WEEKLY;BYDAY=WE,MO')).toBe('Every Mon & Wed')
    expect(rhythmLabel('FREQ=WEEKLY;BYDAY=MO,WE,FR')).toBe('Every Mon, Wed & Fri')
    expect(rhythmLabel('FREQ=MONTHLY;BYDAY=2SU')).toBe('2nd Sunday of each month')
    expect(rhythmLabel('FREQ=MONTHLY;BYDAY=-1FR')).toBe('Last Friday of each month')
  })

  it('says nothing for no rule', () => {
    expect(rhythmLabel('')).toBe('')
    expect(rhythmLabel(null)).toBe('')
  })
})

describe('weekdayOf / nthOfMonth', () => {
  it('reads plain dates without the reader’s zone moving them', () => {
    expect(weekdayOf('2026-11-08')).toBe(6) // Sunday
    expect(weekdayOf('2026-11-09')).toBe(0) // Monday
  })

  it('matches how the backend repeats a monthly date', () => {
    expect(nthOfMonth('2026-11-08')).toBe('2nd')
    expect(nthOfMonth('2026-11-22')).toBe('4th')
    expect(nthOfMonth('2026-11-29')).toBe('Last')
  })
})

describe('specSummary', () => {
  it('reads as one line, defaulting to "Doesn’t repeat"', () => {
    expect(specSummary(null)).toBe('Doesn’t repeat')
    expect(specSummary({ freq: 'weekly', weekdays: [5], until: '2026-12-26', skipped: ['2026-10-17'] }, '2026-10-10'))
      .toBe('Every Saturday until 26 Dec · 1 date skipped')
    expect(specSummary({ freq: 'monthly', weekdays: [], until: null, skipped: [] }, '2026-10-10')).toBe('2nd Saturday of each month')
  })
})
