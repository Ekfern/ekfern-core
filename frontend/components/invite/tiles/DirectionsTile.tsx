'use client'

import React from 'react'
import { MapPin, ArrowUpRight } from 'lucide-react'
import { DirectionsTileSettings } from '@/lib/invite/schema'
import { getDirectionsEmbedUrl, getDirectionsHref } from '@/lib/invite/mapUtils'

export interface DirectionsTileProps {
  settings: DirectionsTileSettings
  /** Falls back to the event's location when the tile has no address line of its own. */
  eventLocation?: string
  preview?: boolean
}

/**
 * The map, as its own section.
 *
 * It used to be an optional checkbox inside Event Details, below the fold and
 * disabled until a separate field validated - which is why almost nobody who
 * filled in a venue ever got one.
 *
 * Two deliberate choices about how it behaves:
 *
 * The embed is inert (`pointer-events: none`). An interactive map inside a
 * scrolling page is a trap on a phone: a thumb that lands on it pans the map
 * instead of scrolling the invitation, and the page appears to freeze.
 *
 * The whole thing is one tap target that hands the destination to the device's
 * own map app. Nobody wants to pinch-zoom a 260px window; they want the venue
 * in the app that knows where they are.
 */
export default function DirectionsTile({
  settings,
  eventLocation,
  preview = false,
}: DirectionsTileProps) {
  const embedUrl = getDirectionsEmbedUrl(settings.mapUrl, settings.coordinates, settings.zoom)
  const directionsHref = getDirectionsHref(settings.mapUrl, settings.coordinates)
  const heading = settings.heading ?? 'Getting there'
  const addressLine = settings.addressLine || eventLocation || ''
  const height = settings.height ?? 260
  const textAlign = settings.textAlign ?? 'center'

  // Nothing to point at yet - in the editor say so, on a live invite stay silent.
  if (!embedUrl && !directionsHref) {
    if (!preview) return null
    return (
      <div className="w-full px-4 py-6 text-center text-sm" style={{ color: 'var(--theme-muted)' }}>
        Add an address to show the map.
      </div>
    )
  }

  const body = (
    <>
      {embedUrl && (
        <div
          className="relative w-full overflow-hidden rounded-xl"
          style={{ height: `${height}px` }}
        >
          <iframe
            src={embedUrl}
            title={addressLine ? `Map showing ${addressLine}` : 'Event location map'}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            aria-hidden="true"
            tabIndex={-1}
            className="pointer-events-none absolute inset-0 h-full w-full border-0"
          />
        </div>
      )}
      <div
        className="mt-3 flex items-center gap-2 px-1"
        style={{ justifyContent: textAlign === 'center' ? 'center' : 'flex-start' }}
      >
        <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="text-sm font-medium">{addressLine || 'View location'}</span>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
      </div>
    </>
  )

  return (
    <section
      className="w-full px-4 py-3"
      style={{
        color: settings.fontColor || 'var(--theme-fg)',
        fontFamily: 'var(--theme-font-body)',
        textAlign,
      }}
    >
      {heading && (
        <h3
          className="mb-2 text-xs uppercase tracking-[0.18em] opacity-60"
          style={{ fontFamily: 'var(--theme-font-body)' }}
        >
          {heading}
        </h3>
      )}

      {directionsHref ? (
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          aria-label={
            addressLine ? `Open directions to ${addressLine} in your map app` : 'Open directions in your map app'
          }
        >
          {body}
        </a>
      ) : (
        <div className="block rounded-xl">{body}</div>
      )}
    </section>
  )
}
