/**
 * Where to send someone after they sign in or sign up.
 *
 * A page that needs an account (the co-host invite) sends people to login or
 * signup with ?next=<its own path>, so they come back to it instead of the
 * dashboard. Only a path on this site is accepted - never another origin, a
 * protocol-relative //host, or a javascript: URL - so the parameter cannot be
 * used to bounce someone to a phishing page after they sign in.
 */

export const DEFAULT_AFTER_AUTH = '/host/dashboard'

export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw) return null
  const value = raw.trim()
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  // Control characters and backslashes have no business in our own paths.
  if (/[\u0000-\u001f\\]/.test(value)) return null
  return value
}

export function afterAuthPath(params: { get(name: string): string | null } | null | undefined): string {
  return safeReturnPath(params?.get('next')) ?? DEFAULT_AFTER_AUTH
}

/** The login URL for the current page, so signing in comes back here. */
export function loginPathReturningTo(currentPath: string): string {
  const next = safeReturnPath(currentPath)
  if (!next || next.startsWith('/host/login') || next.startsWith('/host/signup')) return '/host/login'
  return `/host/login?next=${encodeURIComponent(next)}`
}
