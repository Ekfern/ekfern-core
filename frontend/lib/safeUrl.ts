/**
 * A link a host typed, made safe to put in an href on a public page.
 *
 * Nothing checks page_config on the way in, so this is where it is checked:
 * at the point of rendering. Only http and https become links. `javascript:`,
 * `data:` and the rest come back null and the caller shows plain text.
 *
 * A bare domain ("booking.com/hotel") is what people actually paste, so it is
 * read as https rather than refused.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  // "localhost:3000" and "booking.com:443/x" look like a scheme but are hosts.
  const looksLikeHostPort = /^[a-z0-9.-]+:\d+(\/|$)/i.test(trimmed)
  const candidate = hasScheme && !looksLikeHostPort ? trimmed : `https://${trimmed.replace(/^\/+/, '')}`

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  // A host needs a dot to be a real site; this also refuses "https://hello".
  if (!url.hostname.includes('.')) return null
  return url.toString()
}
