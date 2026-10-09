'use client'

import React from 'react'
import { surface } from '@/lib/invite/surfaces'
import { FeatureButtonsTileSettings } from '@/lib/invite/schema'
import Link from 'next/link'
import {
  getCatalogButtonLabel,
  shouldShowCatalogOnEventPage,
} from '@/lib/catalog/placement'
import { catalogUrl } from '@/lib/catalog/source'
import type { CatalogPurpose } from '@/lib/catalog/types'
import { BUTTON_CSS, getButtonStyles } from '@/lib/invite/buttonStyles'
import { usePageDesign } from '@/components/invite/render/AppearanceProvider'
import { useLifecycle } from '@/components/invite/render/LifecycleContext'
import { GUEST_COPY } from '@/lib/invite/lifecycle'

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
  /** Its own id, so the page can single this card out under `featured`. */
  tileId?: string
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
  tileId,
}: FeatureButtonsTileProps) {
  const buttonColor = 'var(--theme-primary)'
  const pageDesign = usePageDesign()
  // The page decides how buttons look, so Save the Date and the RSVP buttons
  // cannot end up drawn differently. A tile may still override it.
  const variant = pageDesign?.buttonStyle ?? 'classic'
  const radius = 'var(--radius-control)'
  const { extraClass, style: btnStyle } = getButtonStyles(buttonColor, variant, radius)

  const lifecycle = useLifecycle()
  // `closed` keeps the button's place but not its link: a guest reads that RSVPs
  // have closed where they would have tapped, and the card never empties out.
  const buttons: Array<{ label: string; href: string; closed?: boolean }> = []

  if (hasRsvp) {
    buttons.push(
      lifecycle && !lifecycle.rsvp_open
        ? { label: GUEST_COPY.rsvpClosedShort, href: '', closed: true }
        : {
            label: settings.rsvpLabel || 'RSVP',
            href: guestToken ? `/event/${eventSlug}/rsvp?g=${guestToken}` : `/event/${eventSlug}/rsvp`,
          },
    )
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
    // Whether there is a card is this tile's decision; what the card is made of
    // and how high it sits are the page's. The two branches used to differ on
    // that: `bordered` already read --shadow-lift while `glass` hardcoded its
    // own, so the same page drew the same card at two different heights
    // depending on which style was chosen.
    const cardWrapperStyle: React.CSSProperties =
      ctaCardStyle === 'none' ? {} : { ...surface(tileId), padding: '20px 24px' }

    const renderButton = (button: (typeof buttons)[number], className: string, key?: number) =>
      button.closed ? (
        // Text in the button's slot, not a button: muted, no hover, nothing to tap.
        <p
          key={key}
          aria-disabled="true"
          className={`${className} border`}
          style={{
            color: 'var(--theme-muted)',
            borderColor: 'color-mix(in srgb, var(--theme-fg) 18%, transparent)',
            borderRadius: radius,
          }}
        >
          {button.label}
        </p>
      ) : (
        <Link key={key} href={button.href} className={`${className} ${extraClass}`} style={btnStyle}>
          {button.label}
        </Link>
      )

    const buttonsRow = (
      buttons.length === 1 ? (
        <div className="flex justify-center">
          {renderButton(buttons[0], 'px-8 py-3 text-center')}
        </div>
      ) : (
        <div className="flex gap-4 justify-center">
          {buttons.map((button, idx) => renderButton(button, 'flex-1 max-w-[200px] px-6 py-3 text-center', idx))}
        </div>
      )
    )

    if (ctaCardStyle === 'none') {
      return (
        <>
          {styleTag}
          <div className="w-full px-4">{buttonsRow}</div>
        </>
      )
    }

    return (
      <>
        {styleTag}
        <div className="w-full px-4 flex justify-center">
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
