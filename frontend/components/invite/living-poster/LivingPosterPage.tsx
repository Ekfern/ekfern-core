'use client'

import React, { useEffect, useMemo } from 'react'
import { InviteConfig } from '@/lib/invite/schema'
import { migrateToTileConfig } from '@/lib/invite/migrateConfig'
import { ThemeProvider, useTheme } from './ThemeProvider'
import TilePreview from '@/components/invite/tiles/TilePreview'
import ScrollIndicator from '@/components/invite/ScrollIndicator'
import TextureOverlay from './TextureOverlay'


interface LivingPosterPageProps {
  config: InviteConfig
  eventSlug: string
  eventDate?: string
  eventTimezone?: string
  hasRsvp?: boolean
  hasRegistry?: boolean
  catalogShowOnEventPage?: boolean
  catalogTitle?: string
  catalogPurpose?: import('@/lib/catalog/types').CatalogPurpose
  skipTextureOverlay?: boolean
  skipBackgroundColor?: boolean
  allowedSubEvents?: any[]
  guestToken?: string | null
  rsvpCount?: number
}

function LivingPosterContent({
  config,
  eventSlug,
  eventDate,
  eventTimezone,
  hasRsvp = false,
  hasRegistry = false,
  catalogShowOnEventPage,
  catalogTitle,
  catalogPurpose,
  skipTextureOverlay = false,
  skipBackgroundColor = false,
  allowedSubEvents = [],
  guestToken,
  rsvpCount,
}: LivingPosterPageProps) {
  const theme = useTheme()
  const backgroundColor = config.customColors?.backgroundColor ?? theme.backgroundColor
  const backgroundGradient = config.customColors?.backgroundGradient
  const pageBackground = backgroundGradient || backgroundColor

  // Set body background to match page background (skip if already set at page level)
  useEffect(() => {
    if (skipBackgroundColor) {
      return
    }
    document.body.style.setProperty('background', pageBackground, 'important')
    document.documentElement.style.setProperty('background', pageBackground, 'important')

    return () => {
      document.body.style.removeProperty('background')
      document.documentElement.style.removeProperty('background')
    }
  }, [pageBackground, skipBackgroundColor])

  const effectiveConfig = useMemo(
    () =>
      config.tiles && config.tiles.length > 0
        ? config
        : migrateToTileConfig(config, config.hero?.title, eventDate),
    [config, eventDate],
  )

  const sortedTiles = [...(effectiveConfig.tiles || [])]
    .filter(tile => tile.enabled !== false)
    .sort((a, b) => a.order - b.order)

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[TILE ORDER DEBUG] Invite page order:', {
      allTiles: (effectiveConfig.tiles || []).map(t => ({
        id: t.id,
        type: t.type,
        enabled: t.enabled,
        order: t.order,
      })),
      enabledTiles: sortedTiles.map(t => ({
        id: t.id,
        type: t.type,
        order: t.order,
      })),
    })
  }

  const sharedProps = {
    eventDate,
    eventTimezone,
    eventSlug,
    hasRsvp,
    hasRegistry,
    catalogShowOnEventPage,
    catalogTitle,
    catalogPurpose,
    allTiles: effectiveConfig.tiles || [],
    allowedSubEvents,
    guestToken,
  }

  return (
    <div className="w-full relative overflow-x-hidden" style={skipBackgroundColor ? {} : { background: pageBackground } as React.CSSProperties}>
      {!skipTextureOverlay && (
        <TextureOverlay
          type={effectiveConfig.texture?.type || 'none'}
          intensity={effectiveConfig.texture?.intensity || 40}
          imageUrl={effectiveConfig.texture?.imageUrl}
          textureBlend={effectiveConfig.texture?.textureBlend}
        />
      )}
      {effectiveConfig.cornerDecorations && (effectiveConfig.cornerDecorations.topLeft || effectiveConfig.cornerDecorations.topRight || effectiveConfig.cornerDecorations.bottomLeft || effectiveConfig.cornerDecorations.bottomRight) && (
        <div className="absolute inset-0 pointer-events-none w-full h-full" style={{ zIndex: 2 }} aria-hidden>
          {effectiveConfig.cornerDecorations.topLeft && (
            <img src={effectiveConfig.cornerDecorations.topLeft} alt="" className="absolute left-0 top-0 w-24 h-24 md:w-32 md:h-32 object-contain object-left-top" />
          )}
          {effectiveConfig.cornerDecorations.topRight && (
            <img src={effectiveConfig.cornerDecorations.topRight} alt="" className="absolute right-0 top-0 w-24 h-24 md:w-32 md:h-32 object-contain object-right-top" />
          )}
          {effectiveConfig.cornerDecorations.bottomLeft && (
            <img src={effectiveConfig.cornerDecorations.bottomLeft} alt="" className="absolute left-0 bottom-0 w-24 h-24 md:w-32 md:h-32 object-contain object-left-bottom" />
          )}
          {effectiveConfig.cornerDecorations.bottomRight && (
            <img src={effectiveConfig.cornerDecorations.bottomRight} alt="" className="absolute right-0 bottom-0 w-24 h-24 md:w-32 md:h-32 object-contain object-right-bottom" />
          )}
        </div>
      )}
      <div
        className={
          effectiveConfig.spacing === 'tight'
            ? 'flex flex-col gap-4'
            : effectiveConfig.spacing === 'spacious'
              ? 'flex flex-col gap-12'
              : 'flex flex-col gap-8'
        }
      >
        {sortedTiles.map((tile) => {
          const tileEl = <TilePreview tile={tile} {...sharedProps} />

          if (tile.type === 'feature-buttons' && hasRsvp && rsvpCount !== undefined && rsvpCount >= 5) {
            const countColor = effectiveConfig.customColors?.fontColor ?? theme.fontColor
            return (
              <div key={tile.id} className="flex flex-col gap-2 w-full">
                <p className="text-center text-sm px-6" style={{ color: countColor, opacity: 0.6 }}>
                  ✓ {rsvpCount} {rsvpCount === 1 ? 'person' : 'people'} attending
                </p>
                {tileEl}
              </div>
            )
          }

          return (
            <React.Fragment key={tile.id}>
              {tileEl}
            </React.Fragment>
          )
        })}
      </div>
      {effectiveConfig.pageFrame?.imageUrl && (
        <div
          className="absolute inset-0 pointer-events-none w-full h-full"
          style={{ zIndex: 5 }}
          aria-hidden
        >
          <img
            src={effectiveConfig.pageFrame.imageUrl}
            alt=""
            className="w-full h-full object-contain"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      )}
      <ScrollIndicator />
    </div>
  )
}

export default function LivingPosterPage(props: LivingPosterPageProps) {
  return (
    <ThemeProvider config={props.config}>
      <LivingPosterContent {...props} />
    </ThemeProvider>
  )
}

