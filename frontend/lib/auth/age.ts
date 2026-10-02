/**
 * The date-of-birth field at signup.
 *
 * Someone under the minimum age gets a field error when they submit, before
 * anything (their email included) is sent to Ekfern. The server applies the
 * same rule (apps/users/age.py) and stays the authority; this copy only keeps
 * an underage visitor's details out of the system altogether.
 *
 * The field never states the minimum age before someone answers - a neutral
 * question rather than one that tells a child what to type. A refusal is not
 * remembered: a mistyped year can simply be corrected.
 */

/** Must match MINIMUM_AGE in backend apps/users/age.py. */
export const MINIMUM_AGE = 18

/** Today as YYYY-MM-DD in the visitor's own zone, for the date input's max. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** An error message for the field, or null when the date is usable. */
export function dateOfBirthProblem(value: string | undefined, now: Date = new Date()): string | null {
  if (!value) return 'Enter your date of birth'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Enter your date of birth'
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return 'Enter your date of birth'
  }
  if (value > todayIso(now)) return 'Your date of birth cannot be in the future'
  if (y < now.getFullYear() - 120) return 'Check your date of birth'
  return null
}

/**
 * Whole years completed by `now`, for a YYYY-MM-DD date of birth. A 29 February
 * birthday counts from 1 March, as on the server.
 */
export function ageOn(value: string, now: Date = new Date()): number {
  const [y, m, d] = value.split('-').map(Number)
  const month = now.getMonth() + 1
  const hadBirthday = month > m || (month === m && now.getDate() >= d)
  return now.getFullYear() - y - (hadBirthday ? 0 : 1)
}

/** True when a usable date of birth is below the minimum age. */
export function isUnderage(value: string, now: Date = new Date()): boolean {
  return dateOfBirthProblem(value, now) === null && ageOn(value, now) < MINIMUM_AGE
}
