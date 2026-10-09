import { describe, expect, it } from 'vitest'
import { nthOfMonth, rhythmLabel, weekdayOf } from './recurrence'

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
