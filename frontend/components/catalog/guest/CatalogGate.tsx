'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarCheck } from 'lucide-react'
import type { CatalogTheme } from '../shared/catalogTheme'

export type CatalogGateCode = 'guest_required' | 'rsvp_required' | 'confirmed_required'

const GATE_COPY: Record<
  CatalogGateCode,
  { title: string; body: string; primaryLabel: string }
> = {
  guest_required: {
    title: 'Use your invite link',
    body: 'This catalog is for invited guests. Open your personal invitation link to continue.',
    primaryLabel: 'Back to invitation',
  },
  rsvp_required: {
    title: 'RSVP first',
    body: 'Complete your RSVP to unlock this catalog. It only takes a minute.',
    primaryLabel: 'Complete RSVP',
  },
  confirmed_required: {
    title: 'For confirmed guests',
    body: 'This catalog is available to guests who confirmed they are attending.',
    primaryLabel: 'Update RSVP',
  },
}

export function CatalogGate({
  code,
  slug,
  guestToken,
  hasRsvp,
  displayTitle,
  theme,
}: {
  code: CatalogGateCode
  slug: string
  guestToken?: string
  hasRsvp?: boolean
  displayTitle: string
  theme: CatalogTheme
}) {
  const inviteHref = guestToken ? `/invite/${slug}?g=${guestToken}` : `/invite/${slug}`
  const rsvpHref = guestToken ? `/event/${slug}/rsvp?g=${guestToken}` : `/event/${slug}/rsvp`
  const copy = GATE_COPY[code]
  const showRsvpPrimary = code === 'rsvp_required' || code === 'confirmed_required'
  const primaryHref = showRsvpPrimary && hasRsvp !== false ? rsvpHref : inviteHref
  const primaryLabel =
    showRsvpPrimary && hasRsvp !== false ? copy.primaryLabel : GATE_COPY.guest_required.primaryLabel

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: theme.bg }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 shadow-lg text-center space-y-5"
        style={{ background: '#fff' }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-[0.15em]"
          style={{ color: theme.primary, opacity: 0.55 }}
        >
          {displayTitle}
        </p>
        <CalendarCheck
          className="h-12 w-12 mx-auto"
          style={{ color: theme.primary, opacity: 0.35 }}
        />
        <h1 className="text-xl font-semibold" style={{ color: theme.fg }}>
          {copy.title}
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: theme.muted }}>
          {copy.body}
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Link
            href={primaryHref}
            className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white"
            style={{ background: theme.primary }}
          >
            {primaryLabel}
          </Link>
          {showRsvpPrimary && (
            <Link
              href={inviteHref}
              className="inline-flex items-center justify-center gap-1.5 text-sm font-medium py-2"
              style={{ color: theme.primary }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to invitation
            </Link>
          )}
          {!showRsvpPrimary && hasRsvp && (
            <Link href={rsvpHref} className="text-sm underline" style={{ color: theme.muted }}>
              Or complete your RSVP
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
