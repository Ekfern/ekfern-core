'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { GalleryTileSettings } from '@/lib/invite/schema'
import { recipe } from '@/lib/invite/recipes'
import { surfaceShadow } from '@/lib/invite/surfaces'
import {
  INVITE_MEDIA_MAX_WIDTH,
  INVITE_VIEWPORT_H,
  useInviteViewport,
} from '../render/useInviteViewport'

/**
 * A gallery of photos on the invitation.
 *
 *   stacked - a pile of prints in one place. Each photo lands on top as you
 *             scroll; the ones underneath darken. Scrolling up reverses it.
 *   grid    - the whole set at once, in a row that wraps.
 *
 * One frame style applies to every photo, and nothing is interactive.
 */
export interface GalleryTileProps {
  settings: GalleryTileSettings
  preview?: boolean
  /** Its own id, so the page can single these prints out under `featured`. */
  tileId?: string
}

/**
 * Tilt per position, in degrees. Fixed and never scroll-linked: a print keeps
 * the angle it landed at, which is what makes the pile read as photographs
 * rather than as an effect.
 */
const TILT = [-2.5, 1.8, -1.5, 2.2, -1.9, 1.4]

/**
 * Scrolling it takes for one photo to land. Declared, not derived from photo
 * height, or the distance changes with viewport and the last print never
 * reaches the top on a small screen. `svh` so hiding browser chrome mid-scroll
 * does not drag the animation with it.
 */
const TRAVEL_PER_PHOTO = `calc(${INVITE_VIEWPORT_H} * 1.4)`

/** Height of the pinned stage. The pile is centred inside it. */
const STAGE_HEIGHT = INVITE_VIEWPORT_H

/**
 * Share of each photo's travel where nothing moves and the front print simply
 * sits there, fully in view.
 *
 * Without it the next photo starts climbing the instant the current one lands,
 * so a photograph is never once on screen by itself - it is always either
 * arriving or being covered. The hold is what gives each one a moment.
 */
const HOLD = 0.3

/**
 * Turn raw scroll into stage progress, holding at each whole number.
 *
 * The pause has to live here rather than in the transforms: every part of the
 * animation reads from this one value, so pausing it pauses the arrival, the
 * veil and the displacement together, and reversing still costs nothing.
 */
function holdAt(progress: number): number {
  const landed = Math.floor(progress)
  const into = progress - landed
  if (into <= HOLD) return landed
  return landed + (into - HOLD) / (1 - HOLD)
}

/**
 * How dark a print goes at each depth. A lookup, not a curve: the first step
 * matters most and no cheap easing puts its steepest part there.
 */
const VEIL_BY_DEPTH = [0, 0.45, 0.7, 0.85]
const MAX_DEPTH = VEIL_BY_DEPTH.length - 1

/** Displacement per photo covering a print. */
const DEPTH_SHIFT_X = 12
const DEPTH_SHIFT_Y = -3
const DEPTH_ROTATE = 2.2
const DEPTH_SCALE = 0.035

/**
 * Where an arriving print waits, as a CSS length it can be multiplied by.
 *
 * `50svh + 50%` puts its top exactly on the bottom edge of the screen: half a
 * viewport plus half a print from the centred position. Expressed against the
 * viewport rather than as a share of the print's own height because the print
 * is not a fixed fraction of the screen - a flat percentage leaves it peeking
 * over the bottom edge on a desktop and well clear of it on a phone, and a
 * photo peeking is a photo covering the one you are trying to look at.
 */
const ARRIVAL_OFFSET = `(${INVITE_VIEWPORT_H} * 0.5 + 50%)`

function veilAt(depth: number): number {
  const d = Math.min(Math.max(depth, 0), MAX_DEPTH)
  const step = Math.floor(d)
  const into = d - step
  const from = VEIL_BY_DEPTH[step]!
  const to = VEIL_BY_DEPTH[Math.min(step + 1, MAX_DEPTH)]!
  return from + (to - from) * into
}

export default function GalleryTile({ settings, tileId }: GalleryTileProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const probeRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])

  // Needed at render time, not just in the driver: prints start at opacity 0
  // and the driver is what reveals them, so a pile nothing drives would show
  // one photo and hide the rest. Starts false so SSR and hydration agree.
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return
    const apply = () => setReducedMotion(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  const eyebrow = settings.eyebrow?.trim()
  const title = settings.title?.trim()
  const hasHeader = !!eyebrow || !!title

  const images = (settings.images || []).filter((image) => image?.src)
  const arrangement = settings.arrangement ?? 'stacked'
  const frame = settings.frame ?? 'none'
  const isStacked = arrangement === 'stacked'
  // One photo is not a pile: there is nothing for it to stack against.
  const isPile = isStacked && images.length > 1 && !reducedMotion

  /**
   * Place every print from one number: `progress` is how many photos have
   * landed, and `depth` is how far a print sits under the top. Everything is a
   * function of it, so scrolling up reverses the animation with no extra code.
   * Measured as the stage's drift inside its section, not from `scrollY`, so it
   * reads the same in the page and in the editor's mockup.
   */
  const { measure: applyViewport } = useInviteViewport(sectionRef)

  const drive = useCallback(() => {
    applyViewport()
    const section = sectionRef.current
    const stage = stageRef.current
    const probe = probeRef.current
    if (!section || !stage || !probe) return

    const travel = probe.offsetHeight || 1
    const scrolled = (stage.getBoundingClientRect().top - section.getBoundingClientRect().top) / travel
    const progress = holdAt(scrolled)

    cardsRef.current.forEach((card, index) => {
      if (!card) return
      const depth = progress - index
      const veil = card.querySelector<HTMLElement>('[data-veil]')

      // Out of sight. The veil is still settled first: a hidden print keeps
      // whatever it was last given, and would flash the wrong shade on return.
      if (depth < -2.2 || depth > MAX_DEPTH + 1) {
        if (veil) veil.style.opacity = depth < 0 ? '0' : veilAt(MAX_DEPTH).toFixed(3)
        card.style.visibility = 'hidden'
        return
      }
      card.style.visibility = 'visible'

      const tilt = TILT[index % TILT.length]!

      if (depth <= 0) {
        // Arriving: climbing into place, squaring up to its resting angle as it
        // lands. Solid the whole way and travelling from off-screen rather than
        // fading in - a photograph being laid on a pile does not materialise.
        const rise = -depth
        card.style.transform =
          `translate3d(0, calc(${ARRIVAL_OFFSET} * ${rise.toFixed(4)}), 0)` +
          ` rotate(${(tilt * (1 - Math.min(rise, 1))).toFixed(2)}deg)`
        card.style.opacity = '1'
        if (veil) veil.style.opacity = '0'
        return
      }

      const d = Math.min(depth, MAX_DEPTH)
      card.style.transform =
        `translate3d(${(d * DEPTH_SHIFT_X).toFixed(2)}px, ${(d * DEPTH_SHIFT_Y).toFixed(2)}px, 0)` +
        ` rotate(${(tilt + d * DEPTH_ROTATE).toFixed(2)}deg)` +
        ` scale(${(1 - d * DEPTH_SCALE).toFixed(3)})`
      card.style.opacity = '1'
      if (veil) veil.style.opacity = veilAt(d).toFixed(3)
    })
  }, [applyViewport])

  useEffect(() => {
    if (!isPile) return

    let frameId = 0
    const run = () => {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(drive)
    }
    run()
    // Capture catches the editor mockup's scrolling as well as the window's.
    window.addEventListener('scroll', run, { passive: true, capture: true })
    window.addEventListener('resize', run)
    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('scroll', run, { capture: true })
      window.removeEventListener('resize', run)
    }
  }, [isPile, images.length, drive])

  if (images.length === 0) {
    return null
  }

  // The gallery kept a shadow scale of its own whose `sm` and `md` were
  // byte-identical copies of the page's two depths - the same values, spelled
  // twice, so a page turned flat left the photographs raised.
  const radius = 'var(--radius-surface)'
  const innerRadius = 'calc(var(--radius-surface) - 2px)'
  const shadow = surfaceShadow(tileId)

  // Portrait for a pile, square for a grid so the rows come out level.
  const aspect = isStacked ? '5 / 7' : '1 / 1'

  // Covers the frame too: a dark photo in a bright border reads as broken.
  const veilRadius = frame === 'polaroid' ? '2px' : radius

  // The same two devices the title tile uses, now by the same names rather than
  // by coincidence. This comment used to claim they matched; they did not - this
  // eyebrow inherited the body face and the title tile's inherited the title
  // face, so one page showed the same label in two typefaces.
  const header = hasHeader ? (
    <div className="w-full px-4 text-center">
      {eyebrow && <p style={recipe('eyebrow')}>{eyebrow}</p>}
      {title && (
        <h2 className="mt-2 leading-tight" style={recipe('header')}>
          {title}
        </h2>
      )}
    </div>
  ) : null

  /** @param fill - size to the stage, so every print in a pile matches. */
  const renderPrint = (image: (typeof images)[number], fill = false) => {
    const caption = image.caption?.trim()
    const showCaption = frame === 'polaroid' || !!caption

    const frameStyle: React.CSSProperties =
      frame === 'polaroid'
        ? {
            background: '#fff',
            padding: '0.75rem 0.75rem 0',
            borderRadius: 2,
            // A polaroid is white card stock rather than the invitation's
            // material, so it keeps its own paper and takes only the height.
            boxShadow: shadow,
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

    return (
      <figure
        className="m-0"
        style={
          fill
            ? { ...frameStyle, display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }
            : frameStyle
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
            ...(fill ? { flex: '1 1 auto', minHeight: 0, height: '100%' } : { aspectRatio: aspect }),
            borderRadius: frame === 'none' ? radius : frame === 'simple' ? innerRadius : 0,
            userSelect: 'none',
            WebkitTouchCallout: 'none',
          }}
        />
        {showCaption && (
          <figcaption
            className="text-center"
            style={{
              // The caption recipe first, then the two things the *frame*
              // decides: a polaroid's lower band writes larger and darker than
              // a caption under a bare print, and keeps its height whether or
              // not the host wrote anything. Size and colour here are structure,
              // not a second opinion about type.
              ...recipe('caption'),
              padding: frame === 'polaroid' ? '0.7rem 0.25rem 0.9rem' : '0.4rem 0 0',
              fontSize: frame === 'polaroid' ? '0.95rem' : '0.78rem',
              lineHeight: 1.3,
              // A polaroid's band is ink on white card stock, so it keeps a
              // colour of its own - that is the frame, not the page. Any other
              // caption takes its role's ink, which is the Title colour.
              ...(frame === 'polaroid' ? { color: '#3b332c' } : {}),
              minHeight: frame === 'polaroid' ? '2.2rem' : undefined,
              flex: fill ? '0 0 auto' : undefined,
            }}
          >
            {caption}
          </figcaption>
        )}
      </figure>
    )
  }

  if (isStacked) {
    // 46svh of width is 65% of the viewport in height at a 5:7 ratio, which is
    // how large the pile reads against the screen in the design this follows.
    // The other two caps keep it off the edges of a narrow screen and stop it
    // growing without limit on a tall desktop one.
    // The shared width cap, plus a height cap of its own: a print has to fit
    // the screen it is pinned to, which a map sitting in normal flow does not.
    const tall = hasHeader ? 0.4 : 0.46
    const printWidth = `min(${INVITE_MEDIA_MAX_WIDTH}, calc(${INVITE_VIEWPORT_H} * ${tall}))`

    if (!isPile) {
      return (
        <section ref={sectionRef} className="w-full px-4" aria-label="Photo gallery">
          {header}
          <div
            className="mx-auto flex flex-col items-center"
            style={{ gap: 'var(--space-section, 2rem)', marginTop: hasHeader ? 'var(--space-section, 2rem)' : undefined }}
          >
            {images.map((image) => (
              <div key={image.id || image.src} className="w-full" style={{ maxWidth: printWidth }}>
                {renderPrint(image)}
              </div>
            ))}
          </div>
        </section>
      )
    }

    return (
      <section
        ref={sectionRef}
        className="invite-photo-stack relative w-full px-4"
        aria-label="Photo gallery"
        style={
          {
            '--stack-travel': TRAVEL_PER_PHOTO,
            // Scroll budget: one travel for every photo after the first, plus a
            // screen so the stage has somewhere to pin and the finished pile
            // gets a moment before the next tile arrives.
            height: `calc(${images.length - 1} * var(--stack-travel) + ${STAGE_HEIGHT} + 0.35 * var(--stack-travel))`,
          } as React.CSSProperties
        }
      >
        {/* Reports what `--stack-travel` resolves to in pixels. A custom
            property reads back as the literal `65svh`, and the driver needs the
            number - measuring it keeps the CSS the single source of the pace. */}
        <div
          ref={probeRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 w-0 opacity-0"
          style={{ height: 'var(--stack-travel)' }}
        />
        {/* A full-height band pinned to the viewport, with the pile centred in
            it - so the photos sit in the middle of the screen rather than
            against its top edge, and an arriving print has room below to climb
            out of. */}
        <div
          ref={stageRef}
          className="sticky flex flex-col items-center justify-center"
          style={{ top: 0, height: STAGE_HEIGHT, gap: 'var(--space-section, 2rem)' }}
        >
          {header}
          <div className="relative" style={{ width: printWidth, aspectRatio: '5 / 7' }}>
          {images.map((image, index) => (
            <div
              key={image.id || image.src}
              ref={(el) => {
                cardsRef.current[index] = el
              }}
              data-print
              className="absolute inset-0"
              style={{
                // Later photos land on top of earlier ones, which is the whole
                // premise of a pile.
                zIndex: index,
                // The first print is already in place; the rest start below and
                // out of sight, so nothing flashes before the first frame runs.
                transform:
                  index === 0
                    ? `rotate(${TILT[0]}deg)`
                    : `translate3d(0, calc(${ARRIVAL_OFFSET} * ${index}), 0)`,
                opacity: 1,
                willChange: 'transform, opacity',
              }}
            >
              {renderPrint(image, true)}
              <div
                data-veil
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ background: '#0b0b0c', opacity: 0, borderRadius: veilRadius }}
              />
            </div>
          ))}
          </div>
        </div>
      </section>
    )
  }

  // Grid: a row that fills, then wraps, centred at every count - so one photo
  // sits in the middle and five leave a centred pair rather than a hole.
  return (
    <section ref={sectionRef} className="w-full px-4" aria-label="Photo gallery">
      {header}
      <div
        className="mx-auto flex flex-wrap justify-center"
        style={{
          gap: 'var(--space-cluster, 1rem)',
          maxWidth: '620px',
          marginTop: hasHeader ? 'var(--space-section, 2rem)' : undefined,
        }}
      >
        {images.map((image) => (
          <div key={image.id || image.src} style={{ flex: '0 0 auto', width: '184px', maxWidth: '100%' }}>
            {renderPrint(image)}
          </div>
        ))}
      </div>
    </section>
  )
}
