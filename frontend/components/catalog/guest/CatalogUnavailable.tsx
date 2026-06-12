'use client'

import React from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { DEFAULT_CATALOG_THEME } from '../shared/catalogTheme'

export function CatalogUnavailable({
  error,
  slug,
  guestToken,
  hasRsvp,
  theme = DEFAULT_CATALOG_THEME,
}: {
  error: string
  slug: string
  guestToken?: string
  hasRsvp?: boolean
  theme?: typeof DEFAULT_CATALOG_THEME
}) {
  const inviteHref = guestToken ? `/invite/${slug}?g=${guestToken}` : `/invite/${slug}`
  const rsvpHref = guestToken ? `/event/${slug}/rsvp?g=${guestToken}` : `/event/${slug}/rsvp`

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: theme.bg }}
    >
      <div className="text-center max-w-sm space-y-4">
        <Heart className="h-10 w-10 mx-auto opacity-30" style={{ color: theme.primary }} />
        <p className="text-lg font-medium" style={{ color: theme.fg }}>
          Catalog unavailable
        </p>
        <p className="text-sm" style={{ color: theme.muted }}>
          {error}
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Link
            href={inviteHref}
            className="text-sm font-medium underline"
            style={{ color: theme.primary }}
          >
            Back to invitation
          </Link>
          {hasRsvp && (
            <Link href={rsvpHref} className="text-sm underline" style={{ color: theme.muted }}>
              Complete your RSVP
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
