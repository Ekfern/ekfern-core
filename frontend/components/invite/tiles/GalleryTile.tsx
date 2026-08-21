'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
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
 *   stacked - a pile of prints in one place, near the top of the screen. Scroll
 *             down and each photo lands on top of the pile; the ones underneath
 *             darken as they are covered. Scroll back up and they lift off
 *             again, and the pile clears.
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
 * the pile read as photographs someone put down rather than as an effect - a
 * print keeps the angle it landed at. Cycled so a stack of any length keeps
 * alternating.
 */
const TILT = [-2.5, 1.8, -1.5, 2.2, -1.9, 1.4]

/**
 * How much scrolling it takes for one photo to land on the pile.
 *
 * Declared here rather than derived from the photos, which is what the previous
 * version did: it spaced prints down the page and let the distance between them
 * fall out of photo height plus gap. That distance changed with viewport and
 * photo count, and on a small screen the page ran out of scroll before the last
 * print ever reached the top - the stack simply never formed. A fixed budget
 * per photo is the same on every screen.
 *
 * `svh` rather than `vh` so the budget does not change when mobile browser
 * chrome hides mid-scroll and drags the animation with it.
 */
const TRAVEL_PER_PHOTO = '65svh'

/** Where the pile sits. Close to the top edge, so photos land into view. */
const STACK_TOP = '16px'

/**
 * How dark a print goes at each depth under the pile.
 *
 * A lookup rather than a formula because the first step matters most - a print
 * has to read as *covered* the moment something lands on it - and no cheap
 * curve puts its steepest part there. Interpolated between steps, so a print
 * halfway between depths is halfway darkened.
 */
const VEIL_BY_DEPTH = [0, 0.45, 0.7, 0.85]
const MAX_DEPTH = VEIL_BY_DEPTH.length - 1

/** How a print is displaced for each photo covering it. */
const DEPTH_SHIFT_X = 12 // px to the right
const DEPTH_SHIFT_Y = -3 // px, drifting slightly up
const DEPTH_ROTATE = 2.2 // degrees
const DEPTH_SCALE = 0.035 // shrink, so the pile recedes

/** How far below the pile an arriving print starts, as a share of its height. */
const ARRIVAL_RISE = 62

/** The last stretch of an arrival, over which the print fades in. */
const ARRIVAL_FADE = 0.7

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

function veilAt(depth: number): number {
  const d = Math.min(Math.max(depth, 0), MAX_DEPTH)
  const step = Math.floor(d)
  const into = d - step
  const from = VEIL_BY_DEPTH[step]!
  const to = VEIL_BY_DEPTH[Math.min(step + 1, MAX_DEPTH)]!
  return from + (to - from) * into
}

export default function GalleryTile({ settings }: GalleryTileProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const probeRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])

  /**
   * Whether to pile the prints at all.
   *
   * This has to be known while rendering, not only inside the driver: prints
   * are laid on top of each other at opacity 0 and it is the driver that
   * reveals them, so a pile nothing is driving shows one photo and hides the
   * rest. Reduced motion gets a plain column instead - the photographs, in
   * order, with no pinning and nothing that moves on scroll.
   *
   * Starts false so the server and the first client render agree; a browser
   * asking for less motion drops to the column on the effect that follows.
   */
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return
    const apply = () => setReducedMotion(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  const images = (settings.images || []).filter((image) => image?.src)
  const arrangement = settings.arrangement ?? 'stacked'
  const frame = settings.frame ?? 'none'
  const isStacked = arrangement === 'stacked'
  // One photo is not a pile: there is nothing for it to stack against.
  const isPile = isStacked && images.length > 1 && !reducedMotion

  /**
   * Place every print from a single number.
   *
   * `progress` is how many photos have landed, as a decimal, and a print's
   * `depth` is how far it sits under the top of the pile. Everything - the
   * arrival, the displacement, the veil - is a function of that one value, so
   * scrolling back up reverses the whole animation without any code of its own:
   * depth simply decreases again and prints lift off the pile.
   *
   * Driven from scroll rather than an IntersectionObserver because the value is
   * continuous. Measured as the stage's drift inside its section rather than
   * from `scrollY`, which means it reads the same whether the page is scrolling
   * or the editor's phone mockup is.
   */
  const drive = useCallback(() => {
    const section = sectionRef.current
    const stage = stageRef.current
    const probe = probeRef.current
    if (!section || !stage || !probe) return

    const travel = probe.offsetHeight || 1
    const progress = (stage.getBoundingClientRect().top - section.getBoundingClientRect().top) / travel

    cardsRef.current.forEach((card, index) => {
      if (!card) return
      const depth = progress - index
      const veil = card.querySelector<HTMLElement>('[data-veil]')

      // Far below the pile or buried well under it: nothing to paint. The veil
      // is still settled to where that depth belongs before hiding, because a
      // hidden print keeps whatever it was last given - and a print that comes
      // back into view wearing the wrong veil flashes on the way in.
      if (depth < -1.05 || depth > MAX_DEPTH + 1) {
        if (veil) veil.style.opacity = depth < 0 ? '0' : veilAt(MAX_DEPTH).toFixed(3)
        card.style.visibility = 'hidden'
        return
      }
      card.style.visibility = 'visible'

      const tilt = TILT[index % TILT.length]!

      if (depth <= 0) {
        // Arriving: rising into place, and squaring up to its resting angle as
        // it lands so the print settles rather than snapping.
        const rise = Math.min(1, -depth)
        card.style.transform =
          `translate3d(0, ${(rise * ARRIVAL_RISE).toFixed(2)}%, 0) rotate(${(tilt * (1 - rise)).toFixed(2)}deg)`
        card.style.opacity = clamp01(1 + depth / ARRIVAL_FADE).toFixed(3)
        if (veil) veil.style.opacity = '0'
        return
      }

      // Landed, and being buried by whatever came after it.
      const d = Math.min(depth, MAX_DEPTH)
      card.style.transform =
        `translate3d(${(d * DEPTH_SHIFT_X).toFixed(2)}px, ${(d * DEPTH_SHIFT_Y).toFixed(2)}px, 0)` +
        ` rotate(${(tilt + d * DEPTH_ROTATE).toFixed(2)}deg)` +
        ` scale(${(1 - d * DEPTH_SCALE).toFixed(3)})`
      card.style.opacity = '1'
      if (veil) veil.style.opacity = veilAt(d).toFixed(3)
    })
  }, [])

  useEffect(() => {
    // `isPile` is already false for reduced motion and for a lone photo, so
    // there is nothing to drive in either case.
    if (!isPile) return

    let frameId = 0
    const run = () => {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(drive)
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
  }, [isPile, images.length, drive])

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

  // The veil has to cover the frame as well as the photo - a darkened picture
  // in a bright white polaroid border reads as a broken image rather than a
  // buried one.
  const veilRadius = frame === 'polaroid' ? '2px' : radius

  /**
   * @param fill - size to the stage rather than to the photo's own ratio. The
   *   pile needs every print the same size whatever its picture, or the stack
   *   edges do not line up.
   */
  const renderPrint = (image: (typeof images)[number], fill = false) => {
    const caption = image.caption?.trim()
    const showCaption = frame === 'polaroid' || !!caption

    const frameStyle: React.CSSProperties =
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
              // The polaroid's lower band is the whole point of the frame, so it
              // keeps its height whether or not the host wrote anything.
              padding: frame === 'polaroid' ? '0.7rem 0.25rem 0.9rem' : '0.4rem 0 0',
              fontSize: frame === 'polaroid' ? '0.95rem' : '0.78rem',
              lineHeight: 1.3,
              color: frame === 'polaroid' ? '#3b332c' : 'var(--theme-muted)',
              fontFamily: 'var(--theme-font-body)',
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
    // Width is capped three ways: a print never gets bigger than 320px, never
    // wider than most of a narrow screen, and never taller than the screen it
    // has to sit on. The last cap is what keeps the pile whole on a short
    // phone instead of running off the bottom of it.
    const printWidth = 'min(320px, 78vw, (100svh - 120px) * 5 / 7)'

    if (!isPile) {
      return (
        <section className="w-full px-4 py-2" aria-label="Photo gallery">
          <div
            className="mx-auto flex flex-col items-center"
            style={{ gap: 'var(--space-section, 2rem)' }}
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
            height: `calc(${images.length - 1} * var(--stack-travel) + 100svh)`,
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
        <div
          ref={stageRef}
          className="sticky mx-auto"
          style={{ top: STACK_TOP, width: printWidth, aspectRatio: '5 / 7' }}
        >
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
                transform: index === 0 ? `rotate(${TILT[0]}deg)` : `translate3d(0, ${ARRIVAL_RISE}%, 0)`,
                opacity: index === 0 ? 1 : 0,
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
        {images.map((image) => (
          <div key={image.id || image.src} style={{ flex: '0 0 auto', width: '184px', maxWidth: '100%' }}>
            {renderPrint(image)}
          </div>
        ))}
      </div>
    </section>
  )
}
