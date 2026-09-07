'use client'

import React, { useRef } from 'react'
import { MapPin, ArrowUpRight } from 'lucide-react'
import { DirectionsTileSettings } from '@/lib/invite/schema'
import { getDestinationLabel, getDirectionsEmbedUrl, getDirectionsHref } from '@/lib/invite/mapUtils'
import StaticTileMap from './StaticTileMap'
import { INVITE_MEDIA_MAX_WIDTH, useInviteViewport } from '../render/useInviteViewport'
import { recipe } from '@/lib/invite/recipes'

export interface DirectionsTileProps {
  settings: DirectionsTileSettings
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
export default function DirectionsTile({ settings, preview = false }: DirectionsTileProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const { size: viewport } = useInviteViewport(sectionRef)

  const embedUrl = getDirectionsEmbedUrl(settings.mapUrl, settings.coordinates, settings.zoom)
  const directionsHref = getDirectionsHref(settings.mapUrl, settings.coordinates)
  const heading = settings.heading ?? 'Getting there'
  // Always the destination, never a value borrowed from elsewhere: captioning
  // an Agra map with the event's "Mumbai" is worse than no caption at all.
  const addressLine = settings.addressLine?.trim() || getDestinationLabel(settings.mapUrl, settings.coordinates) || ''
  // A share of the screen, like a photograph, rather than a height in pixels.
  // A pixel height cannot be predictable: the same 400px is a third of a laptop
  // and half a phone, so a host choosing it once could not know what a guest
  // would see. A number rather than a CSS length because the tile grid and the
  // torn-edge mask are both sized in pixels, and a container the mask does not
  // match is a tear that falls outside the frame.
  const height = viewport
    ? Math.min(Math.max(Math.round(viewport.height * 0.42), 240), 460)
    : 300
  const textAlign = settings.textAlign ?? 'center'

  // Nothing to point at yet, so render nothing - anywhere.
  //
  // `preview` is set by TilePreview for the live invitation as well as the
  // editor, so a prompt here would be shown to guests. The host can already see
  // the tile and its empty address field in the settings panel; a guest should
  // simply see no map section at all.
  if (!embedUrl && !directionsHref) return null

  const body = (
    <div className="mx-auto w-full" style={{ maxWidth: INVITE_MEDIA_MAX_WIDTH }}>
      {settings.coordinates ? (
        // Tiles as images: no frame, no script, and the same map the editor's
        // picker shows, so the two surfaces finally look alike.
        <StaticTileMap
          lat={settings.coordinates.lat}
          lng={settings.coordinates.lng}
          zoom={settings.zoom ?? 16}
          height={height}
          style={settings.mapStyle}
          label={addressLine || undefined}
        />
      ) : (
        embedUrl && (
          // Older tiles carry a pasted map link and no coordinates, so there is
          // no point to centre on. Re-picking the address upgrades them.
          <div
            className="relative w-full overflow-hidden"
            style={{ height: `${height}px`, borderRadius: 'var(--radius-surface)' }}
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
        )
      )}
      <div
        className="mt-3 flex items-center gap-2 px-1"
        style={{ justifyContent: textAlign === 'center' ? 'center' : 'flex-start' }}
      >
        <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span style={recipe('caption')}>{addressLine || 'View location'}</span>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
      </div>
    </div>
  )

  return (
    <section
      ref={sectionRef}
      className="w-full px-4"
      style={{ ...recipe('body'), color: 'var(--theme-fg)', textAlign }}
    >
      {/* The same kicker the title and the gallery use. It used to set its own
          0.18em against their 0.3em, which is how one page produced four labels
          doing one job at four different trackings. */}
      {heading && (
        <h3 className="mb-2 opacity-60" style={recipe('eyebrow')}>
          {heading}
        </h3>
      )}

      {directionsHref ? (
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2" style={{ borderRadius: 'var(--radius-surface)' }}
          aria-label={
            addressLine ? `Open directions to ${addressLine} in your map app` : 'Open directions in your map app'
          }
        >
          {body}
        </a>
      ) : (
        <div className="block" style={{ borderRadius: 'var(--radius-surface)' }}>{body}</div>
      )}
    </section>
  )
}
