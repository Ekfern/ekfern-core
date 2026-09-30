/**
 * Unit tests for the signup date-of-birth field and the refusal memory.
 */

import { describe, expect, it } from 'vitest'
import { AGE_BLOCK_MS, dateOfBirthProblem, isAgeBlocked, rememberAgeBlock, todayIso } from './age'

const now = new Date(2026, 8, 30, 12) // 30 Sep 2026, local time

function memoryStore() {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
}

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

  it('does not reveal the minimum age', () => {
    // A 10-year-old's date passes the form check; only the server decides.
    expect(dateOfBirthProblem('2016-01-01', now)).toBeNull()
  })
})

describe('age block', () => {
  it('lasts a day and then lifts', () => {
    const store = memoryStore()
    const t = now.getTime()
    expect(isAgeBlocked(store, t)).toBe(false)
    rememberAgeBlock(store, t)
    expect(isAgeBlocked(store, t + 1000)).toBe(true)
    expect(isAgeBlocked(store, t + AGE_BLOCK_MS + 1)).toBe(false)
  })

  it('survives storage being unavailable', () => {
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    expect(() => rememberAgeBlock(broken)).not.toThrow()
    expect(isAgeBlocked(broken)).toBe(false)
  })
})

describe('todayIso', () => {
  it('formats the local date', () => {
    expect(todayIso(now)).toBe('2026-09-30')
  })
})
