/**
 * The date-of-birth field at signup.
 *
 * The server decides who is old enough (apps/users/age.py); the form only
 * checks that a real date was entered. It deliberately does not state the
 * minimum age before someone answers - a neutral question, as regulators
 * recommend, rather than one that tells a child what to type.
 *
 * After a refusal the browser remembers it for a day, so pressing Back and
 * trying an older date does not work straight away.
 */

export const AGE_BLOCK_KEY = 'ekfern_signup_age_block'
export const AGE_BLOCK_MS = 24 * 60 * 60 * 1000

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

type Store = Pick<Storage, 'getItem' | 'setItem'>

export function rememberAgeBlock(store: Store | null, now: number = Date.now()): void {
  try {
    store?.setItem(AGE_BLOCK_KEY, String(now + AGE_BLOCK_MS))
  } catch {
    // Storage can be unavailable (private mode); the server still refuses.
  }
}

export function isAgeBlocked(store: Store | null, now: number = Date.now()): boolean {
  try {
    const until = Number(store?.getItem(AGE_BLOCK_KEY))
    return Number.isFinite(until) && until > now
  } catch {
    return false
  }
}
