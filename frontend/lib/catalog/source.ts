export type CatalogSource =
  | 'rsvp_confirmation'
  | 'invite'
  | 'direct'
  | 'qr'
  | 'event_page'

const VALID_SOURCES: CatalogSource[] = [
  'rsvp_confirmation',
  'invite',
  'direct',
  'qr',
  'event_page',
]

export function parseCatalogSource(raw: string | null | undefined): CatalogSource {
  if (raw && VALID_SOURCES.includes(raw as CatalogSource)) {
    return raw as CatalogSource
  }
  return 'direct'
}

export function catalogUrl(
  slug: string,
  opts?: { guestToken?: string; accessPass?: string; source?: CatalogSource },
): string {
  const params = new URLSearchParams()
  if (opts?.guestToken) params.set('g', opts.guestToken)
  // Short-lived proof that this visitor's number is on the guest list, minted
  // when they verified. Carries membership from the RSVP flow into the registry
  // so a guest who just proved themselves is not asked again.
  else if (opts?.accessPass) params.set('p', opts.accessPass)
  if (opts?.source) params.set('source', opts.source)
  const qs = params.toString()
  return qs ? `/catalog/${slug}?${qs}` : `/catalog/${slug}`
}

export function catalogAbsoluteUrl(
  origin: string,
  slug: string,
  opts?: { guestToken?: string; accessPass?: string; source?: CatalogSource },
): string {
  const path = catalogUrl(slug, opts)
  return path.startsWith('http') ? path : `${origin.replace(/\/$/, '')}${path}`
}

export function sourceLabel(source: CatalogSource | string): string {
  switch (source) {
    case 'rsvp_confirmation':
      return 'After RSVP'
    case 'invite':
      return 'Invitation'
    case 'direct':
      return 'Direct link'
    case 'qr':
      return 'QR code'
    case 'event_page':
      return 'Invite / event (legacy)'
    default:
      return 'Direct link'
  }
}
