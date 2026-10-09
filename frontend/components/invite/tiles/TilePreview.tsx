'use client'

import React from 'react'
import { Tile } from '@/lib/invite/schema'
import TitleTile from './TitleTile'
import GalleryTile from './GalleryTile'
import TimerTile from './TimerTile'
import EventDetailsTile from './EventDetailsTile'
import DirectionsTile from './DirectionsTile'
import DescriptionTile from './DescriptionTile'
import FeatureButtonsTile from './FeatureButtonsTile'
import FooterTile from './FooterTile'
import EventCarouselTile from './EventCarouselTile'
import PosterTile from './PosterTile'
import { useLifecycle } from '@/components/invite/render/LifecycleContext'
import { GUEST_COPY } from '@/lib/invite/lifecycle'

export interface TilePreviewProps {
  tile: Tile
  eventDate?: string
  eventTimezone?: string
  eventSlug?: string
  eventTitle?: string
  hasRsvp?: boolean
  hasRegistry?: boolean
  catalogShowOnEventPage?: boolean
  catalogTitle?: string
  catalogPurpose?: import('@/lib/catalog/types').CatalogPurpose
  allTiles?: Tile[]
  allowedSubEvents?: any[]
  guestToken?: string | null
}

export default function TilePreview({
  tile,
  eventDate,
  eventTimezone,
  eventSlug,
  eventTitle,
  hasRsvp,
  hasRegistry,
  catalogShowOnEventPage,
  catalogTitle,
  catalogPurpose,
  allTiles = [],
  allowedSubEvents = [],
  guestToken,
}: TilePreviewProps) {
  const lifecycle = useLifecycle()
  if (!tile.enabled) return null

  const renderTile = () => {
    switch (tile.type) {
      case 'title':
        return (
          <TitleTile
            settings={tile.settings as any}
            preview
          />
        )
      case 'gallery':
        return (
          <GalleryTile
            settings={tile.settings as any}
            preview
            tileId={tile.id}
          />
        )
      case 'poster':
        return (
          <PosterTile
            settings={tile.settings as any}
            preview
          />
        )
      case 'timer':
        // Get event date and time from event-details tile, fallback to eventDate prop
        const eventDetailsTile = allTiles.find(t => t.type === 'event-details' && t.enabled)
        const eventDetailsDate = eventDetailsTile && eventDetailsTile.type === 'event-details' 
          ? (eventDetailsTile.settings as import('@/lib/invite/schema').EventDetailsTileSettings).date
          : undefined
        const eventTime = eventDetailsTile && eventDetailsTile.type === 'event-details'
          ? (eventDetailsTile.settings as import('@/lib/invite/schema').EventDetailsTileSettings).time
          : undefined
        // Use date from event-details tile if available, otherwise use eventDate prop
        let timerDate = eventDetailsDate || eventDate
        if (lifecycle) {
          // Nothing left to count down to once it has ended or been called off.
          if (lifecycle.phase === 'ended' || lifecycle.phase === 'cancelled' || lifecycle.phase === 'archived') return null
          // A series counts to its next gathering, not its first.
          if (lifecycle.series) {
            if (lifecycle.series.today) return <TodayLine />
            timerDate = lifecycle.series.next_date || undefined
          } else if (lifecycle.phase === 'happening') {
            // Under way - possibly a multi-day wedding between its functions -
            // so neither a countdown to its first day nor "today" is true.
            return null
          }
        }
        return <TimerTile settings={tile.settings as any} preview eventDate={timerDate} eventTime={eventTime} eventTimezone={eventTimezone} eventSlug={eventSlug} eventTitle={eventTitle} />
      case 'event-details':
        return <EventDetailsTile settings={tile.settings as any} preview tileId={tile.id} eventSlug={eventSlug} eventTitle={eventTitle} eventDate={eventDate} eventTimezone={eventTimezone} />
      case 'directions':
        return <DirectionsTile settings={tile.settings as any} preview />
      case 'description':
        return <DescriptionTile settings={tile.settings as any} preview />
      case 'feature-buttons':
        return (
          <FeatureButtonsTile
            settings={tile.settings as any}
            preview
            hasRsvp={hasRsvp}
            hasRegistry={hasRegistry}
            catalogShowOnEventPage={catalogShowOnEventPage}
            catalogTitle={catalogTitle}
            catalogPurpose={catalogPurpose}
            eventSlug={eventSlug}
            guestToken={guestToken}
            tileId={tile.id}
          />
        )
      case 'footer':
        return <FooterTile settings={tile.settings as any} preview />
      case 'event-carousel':
        // Don't render carousel if there are no sub-events to show
        if (!allowedSubEvents || allowedSubEvents.length === 0) {
          return null
        }
        return (
          <EventCarouselTile
            key={`event-carousel-${tile.id}`}
            settings={tile.settings as any}
            allowedSubEvents={allowedSubEvents}
            eventTimezone={eventTimezone}
            preview={true}
            eventSlug={eventSlug}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="w-full max-w-full min-w-0" style={{ overflowX: 'clip' }}>
      {renderTile()}
    </div>
  )
}

/** In place of a countdown that has reached its day. */
function TodayLine() {
  return (
    <p
      className="w-full px-4 text-center text-lg tracking-wide"
      style={{ color: 'var(--theme-primary)', fontFamily: 'var(--theme-font-title)' }}
    >
      {GUEST_COPY.happening}
    </p>
  )
}
