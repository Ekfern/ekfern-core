/**
 * The event's clock.
 *
 * An invitation shows one time: the one on the wall at the venue. A guest in
 * Mumbai reading about a Chicago wedding is told 7:30 PM CST, because that is
 * the number the hosts will say and the number printed on the venue signage.
 *
 * Conversion happens in exactly one place - the calendar entry - because a
 * calendar is the tool whose job is to hold an instant and render it on the
 * reader's own clock. To hand it one we have to turn a wall clock in a named
 * zone into a real moment, which is what `zonedTimeToUtc` is for.
 *
 * What used to live here was a 400-line list of city names mapped to zones,
 * plus offset arithmetic that reconstructed a zone's offset by formatting noon
 * UTC and subtracting. Nothing imported any of it, and the approach could not
 * survive a DST boundary. `Intl` answers both questions correctly.
 */

/**
 * Zones whose common local abbreviation is not what `Intl` emits.
 *
 * `Intl` renders Asia/Kolkata as "GMT+5:30", which is correct and useless -
 * nobody in India writes that. Only fixed-offset zones belong here: a zone that
 * observes DST cannot be labelled by a constant, so those fall through to
 * `Intl`, which knows which side of the boundary a date sits on.
 */
const FIXED_OFFSET_LABELS: Record<string, string> = {
  'Asia/Kolkata': 'IST',
  'Asia/Dubai': 'GST',
  'Asia/Singapore': 'SGT',
}

/**
 * What to call a zone, on a given date.
 *
 * The date matters: America/Chicago is CST in January and CDT in July, and an
 * invitation that says the wrong one is telling the guest a different hour than
 * it means. Falls back to the IANA name, which is ugly but never wrong.
 */
export function getTimezoneLabel(timeZone: string, on?: Date): string {
  if (!timeZone) return ''

  const fixed = FIXED_OFFSET_LABELS[timeZone]
  if (fixed) return fixed

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
    }).formatToParts(on ?? new Date())
    return parts.find((p) => p.type === 'timeZoneName')?.value || timeZone
  } catch {
    return timeZone
  }
}

/**
 * A zone's offset from UTC, in milliseconds, at a given instant.
 *
 * Formats the instant *in* the zone, reads the wall clock back, and treats that
 * reading as if it were UTC. The difference between the two is the offset. This
 * is the standard trick, and unlike a fixed table it is right on both sides of
 * a DST transition.
 */
function offsetAtInstant(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))

  const read = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value)

  // Some engines render midnight as hour 24 under hour12: false.
  const hour = read('hour') % 24

  const wallClockAsUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    hour,
    read('minute'),
    read('second'),
  )

  return wallClockAsUtc - utcMs
}

/**
 * A wall clock in a named zone, as a real moment.
 *
 * `('2027-01-15', '19:30', 'America/Chicago')` is 01:30 UTC on the 16th - the
 * instant a calendar needs so it can show the guest 7:00 AM IST.
 *
 * Solved by iteration rather than lookup: guess that the wall clock is UTC, ask
 * the zone what its offset is near that guess, correct, then re-ask. The second
 * question matters only within an hour of a DST transition, where the first
 * answer belongs to the wrong side of it.
 *
 * Returns null rather than guessing when the date, time or zone is unusable -
 * a calendar entry at the wrong moment is worse than no calendar entry.
 */
export function zonedTimeToUtc(
  date: string,
  time: string | undefined,
  timeZone: string,
): Date | null {
  if (!date || !timeZone) return null

  const dateOnly = date.includes('T') ? date.slice(0, date.indexOf('T')) : date
  const [year, month, day] = dateOnly.split('-').map(Number)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }

  // A date with no time is midnight in the event's zone, not midnight UTC.
  let hours = 0
  let minutes = 0
  if (time) {
    const [h, m] = time.split(':').map(Number)
    if (!Number.isFinite(h)) return null
    hours = h
    minutes = Number.isFinite(m) ? m : 0
  }

  try {
    const guess = Date.UTC(year, month - 1, day, hours, minutes, 0)
    const firstPass = guess - offsetAtInstant(guess, timeZone)
    const secondPass = guess - offsetAtInstant(firstPass, timeZone)
    const utcMs = secondPass

    return Number.isFinite(utcMs) ? new Date(utcMs) : null
  } catch {
    // An unrecognised IANA name throws inside Intl.
    return null
  }
}

/**
 * The event's own wall clock, formatted for display.
 *
 * Deliberately not a conversion. The host typed "19:30" meaning half past seven
 * at the venue, and that is what a guest is shown wherever they are reading
 * from. The zone only supplies the label.
 */
export function formatEventTime(
  time: string,
  timeZone?: string,
  on?: Date,
): string {
  if (!time) return time

  const [hours, minutes] = time.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time

  const hour12 = ((hours + 11) % 12) + 1
  const meridiem = hours >= 12 ? 'PM' : 'AM'
  const clock = `${hour12}:${String(minutes).padStart(2, '0')} ${meridiem}`

  // No zone means no label. Stamping a guess on it is how every guest outside
  // India came to be told their event was in IST.
  const label = timeZone ? getTimezoneLabel(timeZone, on) : ''
  return label ? `${clock} ${label}` : clock
}
