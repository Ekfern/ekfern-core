/**
 * Choosing an event's time zone without asking the host for an IANA name.
 *
 * The create form works it out - from the town picked in city search, from the
 * country when search is down, or from the host's device for an online event -
 * and shows one line, "Times in India Standard Time · Change". These helpers
 * name zones the way people say them and keep pick lists short.
 */

import { COUNTRY_TIMEZONES } from './countryTimezones'

/** "India Standard Time", "Eastern Time" - the name a person would say. */
export function timeZoneName(zone: string): string {
  for (const style of ['longGeneric', 'long'] as const) {
    try {
      const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: style })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')
      if (part?.value && !/^GMT[+-]/.test(part.value)) return part.value
    } catch {
      return zone
    }
  }
  return zone.replace(/_/g, ' ')
}

/** The zone's own city: "America/Argentina/Buenos_Aires" -> "Buenos Aires". */
export function zoneCity(zone: string): string {
  return (zone.split('/').pop() ?? zone).replace(/_/g, ' ')
}

function offsetOn(zone: string, date: Date): string {
  try {
    return (
      new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
        .formatToParts(date)
        .find((p) => p.type === 'timeZoneName')?.value ?? zone
    )
  } catch {
    return zone
  }
}

export interface ZoneChoice {
  value: string
  label: string
}

/**
 * A pick list for some zones, one entry per distinct clock.
 *
 * Zones that keep the same time all year (Detroit and New York) collapse into
 * the first; zones that share a name but not a clock (Phoenix skips daylight
 * saving that Denver keeps) stay apart. The US goes from 29 entries to the
 * handful a person would recognise.
 */
export function zoneChoices(zones: readonly string[]): ZoneChoice[] {
  const year = new Date().getUTCFullYear()
  const january = new Date(Date.UTC(year, 0, 15))
  const july = new Date(Date.UTC(year, 6, 15))
  const seen = new Map<string, ZoneChoice>()
  for (const zone of zones) {
    const name = timeZoneName(zone)
    const key = `${name}|${offsetOn(zone, january)}|${offsetOn(zone, july)}`
    if (!seen.has(key)) seen.set(key, { value: zone, label: `${name} (${zoneCity(zone)})` })
  }
  return [...seen.values()]
}

export function countryZones(countryCode: string | null | undefined): readonly string[] {
  return (countryCode && COUNTRY_TIMEZONES[countryCode.toUpperCase()]) || []
}

/** The device's zone, or India's when the browser will not say. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
  } catch {
    return 'Asia/Kolkata'
  }
}

/** Every zone for the "Change" list: the browser's own list, else every country's. */
export function allZones(): string[] {
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone')
    if (supported?.length) return supported
  } catch {
    // fall through
  }
  return [...new Set(Object.values(COUNTRY_TIMEZONES).flat())].sort()
}

/** The country a zone belongs to, for a sensible default before any town is picked. */
export function countryForZone(zone: string): string | null {
  for (const [country, zones] of Object.entries(COUNTRY_TIMEZONES)) {
    if (zones.includes(zone)) return country
  }
  return null
}
