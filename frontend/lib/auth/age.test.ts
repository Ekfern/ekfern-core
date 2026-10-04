/**
 * Unit tests for the signup date-of-birth field and the minimum age.
 */

import { describe, expect, it } from 'vitest'
import { MINIMUM_AGE, ageOn, dateOfBirthProblem, isUnderage, todayIso } from './age'

const now = new Date(2026, 8, 30, 12) // 30 Sep 2026, local time

describe('dateOfBirthProblem', () => {
  it('accepts a real past date', () => {
    expect(dateOfBirthProblem('1990-05-17', now)).toBeNull()
  })

  it('asks for a date when it is missing or unreadable', () => {
    expect(dateOfBirthProblem('', now)).toBe('Enter your date of birth')
    expect(dateOfBirthProblem('1990-02-30', now)).toBe('Enter your date of birth')
    expect(dateOfBirthProblem('17/05/1990', now)).toBe('Enter your date of birth')
  })

  it('refuses the future and the implausible', () => {
    expect(dateOfBirthProblem('2026-10-01', now)).toBe('Your date of birth cannot be in the future')
    expect(dateOfBirthProblem('1850-01-01', now)).toBe('Check your date of birth')
  })

  it('leaves the minimum age to isUnderage', () => {
    // A 10-year-old's date is a readable date; the age refusal is separate.
    expect(dateOfBirthProblem('2016-01-01', now)).toBeNull()
  })
})

describe('isUnderage', () => {
  it('refuses a recent date such as 2026-09-20', () => {
    expect(isUnderage('2026-09-20', now)).toBe(true)
  })

  it('allows someone turning 18 today and refuses someone turning 18 tomorrow', () => {
    expect(isUnderage('2008-09-30', now)).toBe(false)
    expect(isUnderage('2008-10-01', now)).toBe(true)
  })

  it('counts a 29 February birthday from 1 March', () => {
    expect(ageOn('2008-02-29', new Date(2026, 1, 28, 12))).toBe(17)
    expect(ageOn('2008-02-29', new Date(2026, 2, 1, 12))).toBe(18)
  })

  it('leaves unusable dates to the field error rather than refusing', () => {
    expect(isUnderage('', now)).toBe(false)
    expect(isUnderage('2027-01-01', now)).toBe(false)
  })

  // [date of birth, today (y, m, d), underage?]
  it.each([
    ['2008-09-29', [2026, 9, 30], false], // turned 18 yesterday
    ['2008-09-30', [2026, 9, 30], false], // turns 18 today
    ['2008-10-01', [2026, 9, 30], true], // turns 18 tomorrow
    ['2008-09-30', [2026, 9, 29], true], // the day before the 18th birthday
    ['2008-08-31', [2026, 9, 1], false], // birthday last month
    ['2008-10-31', [2026, 9, 1], true], // birthday next month
    ['2008-12-31', [2026, 12, 31], false], // year end, the birthday
    ['2008-12-31', [2026, 12, 30], true], // year end, a day short
    ['2008-01-01', [2026, 1, 1], false], // new year's day birthday
    ['2009-01-01', [2026, 12, 31], true], // 17 on the last day of the year
    ['2008-02-29', [2026, 2, 28], true], // leap birthday, not yet
    ['2008-02-29', [2026, 3, 1], false], // leap birthday, counts from 1 March
    ['1990-05-17', [2026, 9, 30], false], // ordinary adult
    ['2026-09-30', [2026, 9, 30], true], // born today
  ] as const)('%s on %j -> underage %s', (dob, [y, m, d], expected) => {
    expect(isUnderage(dob, new Date(y, m - 1, d, 12))).toBe(expected)
  })

  it.each([
    [0, 0], [0, 1], [12, 0], // midnight, a minute past, noon
    [23, 59],
  ])('uses the local calendar date at %i:%i', (h, min) => {
    expect(isUnderage('2008-09-30', new Date(2026, 8, 30, h, min))).toBe(false)
    expect(isUnderage('2008-10-01', new Date(2026, 8, 30, h, min))).toBe(true)
  })

  it('matches the server minimum', () => {
    expect(MINIMUM_AGE).toBe(18)
  })
})

describe('todayIso', () => {
  it('formats the local date', () => {
    expect(todayIso(now)).toBe('2026-09-30')
  })
})
