'use client'

import React from 'react'
import { FeatureButtonsTileSettings } from '@/lib/invite/schema'
import Link from 'next/link'
import {
  getCatalogButtonLabel,
  shouldShowCatalogOnEventPage,
} from '@/lib/catalog/placement'
import { catalogUrl } from '@/lib/catalog/source'
import type { CatalogPurpose } from '@/lib/catalog/types'
import { BUTTON_CSS, getButtonStyles } from '@/lib/invite/buttonStyles'

export interface FeatureButtonsTileProps {
  settings: FeatureButtonsTileSettings
  preview?: boolean
  hasRsvp?: boolean
  hasRegistry?: boolean
  catalogShowOnEventPage?: boolean
  catalogTitle?: string
  catalogPurpose?: CatalogPurpose
  eventSlug?: string
  guestToken?: string | null
}

export default function FeatureButtonsTile({
  settings,
  preview = false,
  hasRsvp = false,
  hasRegistry = false,
  catalogShowOnEventPage,
  catalogTitle,
  catalogPurpose = 'general',
  eventSlug,
  guestToken,
}: FeatureButtonsTileProps) {
  const buttonColor = settings.buttonColor || 'var(--theme-primary, #D4A017)'
  const variant = settings.buttonVariant ?? 'classic'
  const radius  = settings.buttonRadius  ?? 'round'
  const { extraClass, style: btnStyle } = getButtonStyles(buttonColor, variant, radius)

  const buttons: Array<{ label: string; href: string }> = []

  if (hasRsvp) {
    buttons.push({
      label: settings.rsvpLabel || 'RSVP',
      href: guestToken ? `/event/${eventSlug}/rsvp?g=${guestToken}` : `/event/${eventSlug}/rsvp`
    })
  }
  if (shouldShowCatalogOnEventPage(hasRegistry, catalogShowOnEventPage) && eventSlug) {
    buttons.push({
      label: getCatalogButtonLabel(
        catalogTitle,
        catalogPurpose,
        settings.registryLabel,
      ),
      href: catalogUrl(eventSlug, { guestToken: guestToken || undefined, source: 'invite' }),
    })
  }

  const styleTag = <style dangerouslySetInnerHTML={{ __html: BUTTON_CSS }} />

  if (buttons.length === 0) {
    if (preview) return null
    return (
      <>
        {styleTag}
        <div className="w-full py-4 px-4 text-center border rounded bg-gray-50">
          <p className="text-gray-400 text-sm">No features enabled</p>
        </div>
      </>
    )
  }

  if (preview) {
    const ctaCardStyle = settings.ctaCardStyle ?? 'none'
    const ctaCardShadow = settings.ctaCardShadow ?? true
    const cardWrapperStyle: React.CSSProperties =
      ctaCardStyle === 'bordered'
        ? {
            backgroundColor: settings.ctaCardBackgroundColor || '#FFFFFF',
            border: `1px solid ${settings.ctaCardBorderColor || 'rgba(0,0,0,0.1)'}`,
            borderRadius: '16px',
            boxShadow: ctaCardShadow ? '0 12px 32px rgba(0,0,0,0.12)' : undefined,
            padding: '20px 24px',
          }
        : ctaCardStyle === 'glass'
          ? {
              backgroundColor: 'rgba(255,255,255,0.14)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.28)',
              borderRadius: '16px',
              boxShadow: ctaCardShadow ? '0 20px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.25)' : undefined,
              padding: '20px 24px',
            }
          : {}

    const buttonsRow = (
      buttons.length === 1 ? (
        <div className="flex justify-center">
          <Link
            href={buttons[0].href}
            className={`px-8 py-3 text-center ${extraClass}`}
            style={btnStyle}
          >
            {buttons[0].label}
          </Link>
        </div>
      ) : (
        <div className="flex gap-4 justify-center">
          {buttons.map((button, idx) => (
            <Link
              key={idx}
              href={button.href}
              className={`flex-1 max-w-[200px] px-6 py-3 text-center ${extraClass}`}
              style={btnStyle}
            >
              {button.label}
            </Link>
          ))}
        </div>
      )
    )

    if (ctaCardStyle === 'none') {
      return (
        <>
          {styleTag}
          <div className="w-full py-8 px-4">{buttonsRow}</div>
        </>
      )
    }

    return (
      <>
        {styleTag}
        <div className="w-full py-8 px-4 flex justify-center">
          <div className="w-full max-w-sm" style={cardWrapperStyle}>
            {settings.ctaCardLabel && (
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-4"
                style={{ color: ctaCardStyle === 'glass' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }}
              >
                {settings.ctaCardLabel}
              </p>
            )}
            {buttonsRow}
          </div>
        </div>
      </>
    )
  }

  // Settings preview
  return (
    <>
      {styleTag}
      <div className="w-full py-4 px-4 border rounded">
        <div className="flex gap-2 justify-center">
          {buttons.map((button, idx) => (
            <div
              key={idx}
              className={`px-4 py-2 text-sm ${extraClass}`}
              style={btnStyle}
            >
              {button.label}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
