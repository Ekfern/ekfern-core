'use client'

import React, { useCallback, useEffect, useRef } from 'react'
import { GalleryTileSettings } from '@/lib/invite/schema'

/**
 * A gallery of photos on the invitation.
 *
 * This tile used to be a single hero image, and its job has changed: the poster
 * is the hero now, and this is a handful of pictures arranged on the page. One
 * frame style applies to every photo - a gallery of mismatched frames reads as
 * a mistake rather than a choice.
 *
 * Two arrangements, because there are two questions a gallery answers:
 *
 *   stacked - a story, one photograph at a time. Each print sticks while the
 *             next slides over it and the one beneath shrinks away.
 *   grid    - the whole set at once, in a row that wraps.
 *
 * Both are centred. Nothing is interactive: guests get no lightbox, which keeps
 * the page light and avoids a modal on an invitation nobody asked to open.
 * Images are lazy and carry an explicit ratio so the page does not jump as they
 * arrive.
 */
export interface GalleryTileProps {
  settings: GalleryTileSettings
  preview?: boolean
}

const SHADOW: Record<NonNullable<GalleryTileSettings['shadow']>, string> = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,.08)',
  md: '0 4px 10px -2px rgba(0,0,0,.15)',
  lg: '0 10px 20px -6px rgba(0,0,0,.2)',
  xl: '0 20px 34px -10px rgba(0,0,0,.28)',
}

/**
 * How far each print in a stack is tilted, in degrees.
 *
 * Fixed per position and alternating, never scroll-linked. That is what makes
 * the stack read as photographs someone put down rather than as an effect - the
 * angles do not move, only the scale does. Cycled so a stack of any length
 * keeps alternating.
 */
const TILT = [-2.5, 1.8, -1.5, 2.2, -1.9, 1.4]

/** What a print shrinks to once the next one has covered it. */
const BURIED_SCALE = 0.92

export default function GalleryTile({ settings }: GalleryTileProps) {
  const stackRef = useRef<HTMLDivElement>(null)

  const images = (settings.images || []).filter((image) => image?.src)
  const arrangement = settings.arrangement ?? 'stacked'
  const frame = settings.frame ?? 'none'
  const isStacked = arrangement === 'stacked'

  /**
   * Scale each print down as the next one covers it.
   *
   * Driven from scroll rather than an IntersectionObserver because the value is
   * continuous - a print is partly buried long before it is fully covered. The
   * work is a handful of getBoundingClientRect calls inside a rAF, and it runs
   * only while a stacked gallery is on the page.
   */
  const driveStack = useCallback(() => {
    const root = stackRef.current
    if (!root) return
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-print]'))
    cards.forEach((card, index) => {
      const tilt = TILT[index % TILT.length]
      const next = cards[index + 1]
      let buried = 0
      if (next) {
        const gap = next.getBoundingClientRect().top - card.getBoundingClientRect().top
        const travel = card.offsetHeight || 1
        buried = Math.min(1, Math.max(0, 1 - gap / travel))
      }
      const scale = 1 - (1 - BURIED_SCALE) * buried
      card.style.transform = `rotate(${tilt}deg) scale(${scale.toFixed(3)})`
    })
  }, [])

  useEffect(() => {
    if (!isStacked || images.length < 2) return
    // Someone who has asked their system for less motion gets the tilt and
    // nothing else - the prints simply sit in a column.
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      const root = stackRef.current
      root?.querySelectorAll<HTMLElement>('[data-print]').forEach((card, index) => {
        card.style.transform = `rotate(${TILT[index % TILT.length]}deg)`
      })
      return
    }

    let frameId = 0
    const run = () => {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(driveStack)
    }
    run()
    // `true` catches scrolling inside the editor's phone mockup as well as the
    // window, so the preview animates the same way the invitation does.
    window.addEventListener('scroll', run, { passive: true, capture: true })
    window.addEventListener('resize', run)
    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('scroll', run, { capture: true })
      window.removeEventListener('resize', run)
    }
  }, [isStacked, images.length, driveStack])

  if (images.length === 0) {
    // An empty gallery renders nothing, on the invitation and in the preview
    // alike: the host sees the tile and its empty state in the settings panel,
    // which is where a prompt belongs.
    return null
  }

  // A CSS value rather than a number: unset means "whatever the invitation's
  // surfaces use", which cannot be expressed as an integer.
  const radius =
    settings.cornerRadius !== undefined ? `${settings.cornerRadius}px` : 'var(--radius-surface)'
  const innerRadius =
    settings.cornerRadius !== undefined
      ? `${Math.max(settings.cornerRadius - 2, 0)}px`
      : 'calc(var(--radius-surface) - 2px)'
  // A named step still maps to its value; unset means the invitation's own
  // resting elevation.
  const shadow = settings.shadow ? SHADOW[settings.shadow] : 'var(--shadow-rest)'

  // Stacked prints are portrait, which is the shape a photograph of people
  // wants and what makes a polaroid read as one. A grid is square so the rows
  // come out level.
  const aspect = isStacked ? '5 / 7' : '1 / 1'

  const renderPrint = (image: (typeof images)[number], index: number) => {
    const caption = image.caption?.trim()
    const showCaption = frame === 'polaroid' || !!caption

    return (
      <figure
        key={image.id || image.src}
        className="m-0"
        style={
          frame === 'polaroid'
            ? {
                background: '#fff',
                padding: '0.75rem 0.75rem 0',
                borderRadius: 2,
                // A polaroid sits on top of the page rather than in it, so it
                // keeps a shadow even when the gallery asked for none - that is
                // what makes it read as a physical print.
                boxShadow: shadow === 'none' ? 'var(--shadow-lift)' : shadow,
              }
            : frame === 'simple'
              ? {
                  background: '#fff',
                  padding: `${settings.frameWidth ?? 6}px`,
                  border: `1px solid ${settings.frameColor ?? '#D9CFC0'}`,
                  borderRadius: radius,
                  boxShadow: shadow,
                }
              : { boxShadow: shadow, borderRadius: radius }
        }
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
            borderRadius: frame === 'none' ? radius : frame === 'simple' ? innerRadius : 0,
            userSelect: 'none',
            WebkitTouchCallout: 'none',
          }}
        />
        {showCaption && (
          <figcaption
            className="text-center"
            style={{
              // The polaroid's lower band is the whole point of the frame, so it
              // keeps its height whether or not the host wrote anything.
              padding: frame === 'polaroid' ? '0.7rem 0.25rem 0.9rem' : '0.4rem 0 0',
              fontSize: frame === 'polaroid' ? '0.95rem' : '0.78rem',
              lineHeight: 1.3,
              color: frame === 'polaroid' ? '#3b332c' : 'var(--theme-muted)',
              fontFamily: 'var(--theme-font-body)',
              minHeight: frame === 'polaroid' ? '2.2rem' : undefined,
            }}
          >
            {caption}
          </figcaption>
        )}
      </figure>
    )
  }

  if (isStacked) {
    return (
      <section className="w-full px-4 py-2" aria-label="Photo gallery">
        <div ref={stackRef} className="flex flex-col items-center" style={{ gap: 'var(--space-chapter, 4rem)' }}>
          {images.map((image, index) => (
            <div
              key={image.id || image.src}
              data-print
              className="sticky w-full"
              style={{
                top: '1.5rem',
                maxWidth: '320px',
                // The initial tilt is inline so the prints are already at their
                // angles before the first scroll frame runs.
                transform: `rotate(${TILT[index % TILT.length]}deg)`,
                willChange: 'transform',
              }}
            >
              {renderPrint(image, index)}
            </div>
          ))}
          {/* Room for the last print to stick against, so it is not cut off by
              whatever tile follows. */}
          {images.length > 1 && <div aria-hidden className="w-full" style={{ height: '6rem' }} />}
        </div>
      </section>
    )
  }

  // Grid: a row that fills, then wraps, centred at every count - so one photo
  // sits in the middle and five leave a centred pair rather than a hole.
  return (
    <section className="w-full px-4 py-2" aria-label="Photo gallery">
      <div
        className="mx-auto flex flex-wrap justify-center"
        style={{ gap: 'var(--space-cluster, 1rem)', maxWidth: '620px' }}
      >
        {images.map((image, index) => (
          <div key={image.id || image.src} style={{ flex: '0 0 auto', width: '184px', maxWidth: '100%' }}>
            {renderPrint(image, index)}
          </div>
        ))}
      </div>
    </section>
  )
}
