/**
 * Event-timezone <-> UTC helpers for datetime-local inputs.
 *
 * Sub-event times are stored as UTC ISO instants but entered/displayed as
 * wall-time in the event's own timezone. These two helpers convert between a
 * `datetime-local` value (`YYYY-MM-DDTHH:mm`, interpreted as event-timezone
 * wall-time) and a stored UTC ISO string.
 *
 * Extracted from the sub-events management page so the creation-wizard
 * sub-events step can reuse the exact same conversion logic.
 */

/** Convert a stored UTC ISO instant to a `datetime-local` value in the event timezone wall-time. */
export function utcISOToEventTzLocal(isoString: string, timeZone: string): string {
  try {
    const d = new Date(isoString)
    if (Number.isNaN(d.getTime())) return ''
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const parts = fmt.formatToParts(d)
    const get = (type: string) => parts.find((p) => p.type === type)?.value
    const year = get('year')
    const month = get('month')
    const day = get('day')
    const hour = get('hour')
    const minute = get('minute')
    if (!year || !month || !day || !hour || !minute) return ''
    return `${year}-${month}-${day}T${hour}:${minute}`
  } catch {
    return ''
  }
}

/** Interpret a `datetime-local` value as event-timezone wall-time and return the UTC ISO instant. */
export function eventTzLocalToUtcISO(dateTimeLocal: string, timeZone: string): string {
  try {
    const m = dateTimeLocal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
    if (!m) return new Date(dateTimeLocal).toISOString()
    const [, ys, mos, ds, hs, mins] = m
    const y = Number(ys)
    const mo = Number(mos)
    const d = Number(ds)
    const h = Number(hs)
    const min = Number(mins)

    // Initial guess: treat the desired wall-time as if it were UTC.
    let utc = new Date(Date.UTC(y, mo - 1, d, h, min, 0))

    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const getTzParts = (date: Date) => {
      const parts = fmt.formatToParts(date)
      const get = (type: string) => parts.find((p) => p.type === type)?.value
      return {
        year: Number(get('year')),
        month: Number(get('month')),
        day: Number(get('day')),
        hour: Number(get('hour')),
        minute: Number(get('minute')),
      }
    }

    const desiredMs = Date.UTC(y, mo - 1, d, h, min, 0)
    for (let i = 0; i < 2; i++) {
      const tzp = getTzParts(utc)
      const tzMs = Date.UTC(tzp.year, tzp.month - 1, tzp.day, tzp.hour, tzp.minute, 0)
      const diffMs = desiredMs - tzMs
      utc = new Date(utc.getTime() + diffMs)
    }
    return utc.toISOString()
  } catch {
    return new Date(dateTimeLocal).toISOString()
  }
}
