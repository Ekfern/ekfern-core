'use client'

import React from 'react'
import { GalleryTileSettings } from '@/lib/invite/schema'

/**
 * A gallery of photos on the invitation.
 *
 * This tile used to be a single hero image, and its job has changed: the poster
 * is the hero now, and this is a handful of pictures arranged on the page. One
 * frame style applies to every photo - a gallery of mismatched frames reads as
 * a mistake rather than a choice.
 *
 * Nothing here is interactive. Guests get no lightbox, which keeps the page
 * light and avoids a modal on an invitation nobody asked to open. Images are
 * lazy and carry explicit dimensions so the page does not jump as they arrive.
 */
export interface GalleryTileProps {
  settings: GalleryTileSettings
  preview?: boolean
}

const GAP: Record<NonNullable<GalleryTileSettings['spacing']>, string> = {
  tight: '0.5rem',
  normal: '1rem',
  spacious: '1.75rem',
}

const SHADOW: Record<NonNullable<GalleryTileSettings['shadow']>, string> = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,.08)',
  md: '0 4px 10px -2px rgba(0,0,0,.15)',
  lg: '0 10px 20px -6px rgba(0,0,0,.2)',
  xl: '0 20px 34px -10px rgba(0,0,0,.28)',
}

export default function GalleryTile({ settings }: GalleryTileProps) {
  const images = (settings.images || []).filter((image) => image?.src)
  if (images.length === 0) {
    // An empty gallery renders nothing, on the invitation and in the preview
    // alike: the host sees the tile and its empty state in the settings panel,
    // which is where a prompt belongs.
    return null
  }

  const arrangement = settings.arrangement ?? 'vertical'
  const frame = settings.frame ?? 'none'
  const gap = GAP[settings.spacing ?? 'normal']
  const radius = settings.cornerRadius ?? 8
  const shadow = SHADOW[settings.shadow ?? 'sm']

  // Vertical keeps a photo's own proportions; the other two need a common
  // shape or the rows come out ragged.
  const aspect = arrangement === 'vertical' ? '4 / 3' : '1 / 1'

  const containerStyle: React.CSSProperties =
    arrangement === 'grid'
      ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap }
      : arrangement === 'horizontal'
        ? // Wrapping, not sideways scrolling: a strip that scrolls off a phone
          // hides photos a host deliberately added.
          { display: 'flex', flexWrap: 'wrap', gap, justifyContent: 'center' }
        : { display: 'flex', flexDirection: 'column', gap }

  const itemStyle: React.CSSProperties =
    arrangement === 'horizontal'
      ? { flex: '1 1 8rem', minWidth: '8rem', maxWidth: '14rem' }
      : {}

  return (
    <section className="w-full px-4 py-2" aria-label="Photo gallery">
      <div style={containerStyle}>
        {images.map((image) => {
          const caption = image.caption?.trim()
          const showCaption = frame === 'polaroid' || !!caption

          return (
            <figure
              key={image.id || image.src}
              className="m-0"
              style={{
                ...itemStyle,
                ...(frame === 'polaroid'
                  ? {
                      background: '#fff',
                      padding: '0.6rem 0.6rem 0',
                      borderRadius: 2,
                      boxShadow: shadow === 'none' ? '0 2px 6px rgba(0,0,0,.18)' : shadow,
                    }
                  : frame === 'simple'
                    ? {
                        background: '#fff',
                        padding: `${settings.frameWidth ?? 6}px`,
                        border: `1px solid ${settings.frameColor ?? '#D9CFC0'}`,
                        borderRadius: radius,
                        boxShadow: shadow,
                      }
                    : { boxShadow: shadow, borderRadius: radius }),
              }}
            >
              <img
                src={image.src}
                alt={caption || ''}
                loading="lazy"
                decoding="async"
                // Discourages the casual save. Anything displayed can still be
                // retrieved from the cache - this is a signal, not protection.
                draggable={false}
                onContextMenu={(event) => event.preventDefault()}
                className="block w-full object-cover"
                style={{
                  aspectRatio: aspect,
                  borderRadius: frame === 'none' ? radius : frame === 'simple' ? Math.max(radius - 2, 0) : 0,
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                }}
              />
              {showCaption && (
                <figcaption
                  className="text-center"
                  style={{
                    // The polaroid's lower band is the whole point of the
                    // frame, so it keeps its height whether or not the host
                    // wrote anything.
                    padding: frame === 'polaroid' ? '0.55rem 0.25rem 0.75rem' : '0.4rem 0 0',
                    fontSize: '0.78rem',
                    lineHeight: 1.3,
                    color: frame === 'polaroid' ? '#3b332c' : 'var(--theme-muted)',
                    fontFamily: 'var(--theme-font-body)',
                    minHeight: frame === 'polaroid' ? '1.9rem' : undefined,
                  }}
                >
                  {caption}
                </figcaption>
              )}
            </figure>
          )
        })}
      </div>
    </section>
  )
}
