import { describe, expect, it } from 'vitest'
import { countryZones, timeZoneName, zoneChoices, zoneCity } from './eventTimezone'

describe('timeZoneName', () => {
  it('names zones the way people say them', () => {
    expect(timeZoneName('Asia/Kolkata')).toBe('India Standard Time')
    expect(timeZoneName('America/New_York')).toBe('Eastern Time')
  })
})

describe('zoneCity', () => {
  it('takes the last part, with spaces', () => {
    expect(zoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires')
  })
})

describe('countryZones', () => {
  it('gives a one-zone country its zone', () => {
    expect(countryZones('in')).toEqual(['Asia/Kolkata'])
  })

  it('knows nothing of a missing country', () => {
    expect(countryZones(undefined)).toEqual([])
    expect(countryZones('ZZ')).toEqual([])
  })
})

describe('zoneChoices', () => {
  it('collapses zones that keep the same clock all year', () => {
    const us = zoneChoices(countryZones('US'))
    const values = us.map((c) => c.value)
    expect(values).toContain('America/New_York')
    expect(values).not.toContain('America/Detroit')
    expect(us.length).toBeLessThanOrEqual(10)
  })

  it('keeps zones that share a name but not daylight saving', () => {
    const values = zoneChoices(countryZones('US')).map((c) => c.value)
    expect(values).toContain('America/Denver')
    expect(values).toContain('America/Phoenix')
  })

  it('labels each choice with its name and city', () => {
    expect(zoneChoices(['Asia/Kolkata'])).toEqual([{ value: 'Asia/Kolkata', label: 'India Standard Time (Kolkata)' }])
  })
})
