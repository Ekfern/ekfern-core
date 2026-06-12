'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Calendar } from 'lucide-react'
import { getEventDetailsFromConfig } from '@/lib/event/utils'
import type { CatalogTheme } from '../shared/catalogTheme'
import { CatalogGuestChip } from './CatalogGuestChip'
import { CatalogIntroContent } from '../shared/CatalogIntroContent'

export function CatalogHero({
  slug,
  guestToken,
  eventTitle,
  displayTitle,
  introHtml,
  introFallback,
  bannerUrl,
  inviteEvent,
  guestName,
  theme,
}: {
  slug: string
  guestToken?: string
  eventTitle: string
  displayTitle: string
  introHtml?: string
  introFallback: string
  bannerUrl?: string
  inviteEvent?: { date?: string; city?: string; page_config?: unknown }
  guestName?: string
  theme: CatalogTheme
}) {
  const inviteHref = guestToken ? `/invite/${slug}?g=${guestToken}` : `/invite/${slug}`
  const { date, location } = getEventDetailsFromConfig(
    inviteEvent as Parameters<typeof getEventDetailsFromConfig>[0],
  )

  const intro = introHtml || introFallback

  const dateLabel = date
    ? new Date(date).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  if (bannerUrl?.trim()) {
    return (
      <div className="relative w-full">
        <div className="relative w-full h-[280px] sm:h-[360px] md:h-[420px] overflow-hidden">
          <img src={bannerUrl} alt={eventTitle} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60" />
          <div className="absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
            <div className="flex justify-start">
              <Link
                href={inviteHref}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/90 backdrop-blur hover:bg-white transition-colors"
                style={{ color: theme.primary }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to invitation
              </Link>
            </div>
            <div className="text-center text-white max-w-2xl mx-auto pb-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-2 opacity-80">
                {eventTitle}
              </p>
              <h1
                className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg"
                style={{ fontFamily: theme.fontTitle }}
              >
                {displayTitle}
              </h1>
              {(dateLabel || location) && (
                <div className="flex flex-wrap items-center justify-center gap-3 text-sm opacity-90 mb-2">
                  {dateLabel && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {dateLabel}
                    </span>
                  )}
                  {location && <span>{location}</span>}
                </div>
              )}
              <div className="max-w-md mx-auto opacity-90">
                <CatalogIntroContent html={intro} invert className="text-center" />
              </div>
              {guestToken && (
                <div className="mt-3">
                  <CatalogGuestChip guestName={guestName} theme={theme} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-8 pb-4 max-w-2xl mx-auto">
      <div
        className="rounded-2xl px-6 py-8 sm:py-10 text-center shadow-sm"
        style={{
          background: `linear-gradient(180deg, ${theme.primary}10 0%, ${theme.bg} 100%)`,
          border: `1px solid ${theme.primary}14`,
        }}
      >
        <div className="flex justify-center mb-4">
          <Link
            href={inviteHref}
            className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
            style={{ color: theme.primary, opacity: 0.75 }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to invitation
          </Link>
        </div>
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em] mb-3"
          style={{ color: theme.primary, opacity: 0.5 }}
        >
          {eventTitle}
        </p>
        <h1
          className="text-3xl sm:text-4xl font-bold mb-3 leading-tight"
          style={{ fontFamily: theme.fontTitle, color: theme.primary }}
        >
          {displayTitle}
        </h1>
        {(dateLabel || location) && (
          <p className="text-sm mb-3" style={{ color: theme.fg, opacity: 0.55 }}>
            {[dateLabel, location].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="max-w-md mx-auto" style={{ color: theme.fg, opacity: 0.7 }}>
          <CatalogIntroContent html={intro} className="text-center" />
        </div>
        {guestToken && (
          <div className="mt-4">
            <CatalogGuestChip guestName={guestName} theme={theme} />
          </div>
        )}
      </div>
    </div>
  )
}
