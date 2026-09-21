'use client'

import React from 'react'
import { TextureType } from '@/lib/invite/schema'

export interface TextureOverlayProps {
  type: TextureType
  intensity?: number // 0-100, default 20
  imageUrl?: string
  textureBlend?: 'overlay' | 'replace'
}

/**
 * Modern film-grain/noise overlay using an SVG turbulence filter — reads as
 * analog photographic grain over a rich gradient, unlike the repeating-CSS
 * craft-material patterns used by the other texture types.
 */
function GrainOverlay({ opacity }: { opacity: number }) {
  const filterId = `fern-grain-${React.useId().replace(/:/g, '')}`
  return (
    <div
      aria-hidden
      data-texture-type="grain"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
        opacity,
        mixBlendMode: 'overlay',
      }}
    >
      <svg width="100%" height="100%">
        <filter id={filterId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" result="noise" />
          {/* Convert to true grayscale luminance (both dark and light specks) at full
              opacity — 'overlay' blend needs value variation on both sides of mid-gray
              to read on both dark and light backgrounds. Pure-white-at-variable-alpha
              (the previous approach) only ever lightens, which is nearly invisible
              once blended over a dark gradient. */}
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 1"
          />
          <feComponentTransfer>
            <feFuncR type="linear" slope="2.2" intercept="-0.35" />
            <feFuncG type="linear" slope="2.2" intercept="-0.35" />
            <feFuncB type="linear" slope="2.2" intercept="-0.35" />
          </feComponentTransfer>
        </filter>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </div>
  )
}

/**
 * Lit fractal-noise surface. Reads as stone or plaster, not paper —
 * raking light and high relief carved the folds into a wall.
 */
function StoneOverlay({ opacity }: { opacity: number }) {
  const filterId = `fern-stone-${React.useId().replace(/:/g, '')}`
  return (
    <div
      aria-hidden
      data-texture-type="stone"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
        opacity,
        mixBlendMode: 'overlay',
      }}
    >
      <svg width="100%" height="100%" preserveAspectRatio="none">
        <filter id={filterId} colorInterpolationFilters="sRGB" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.016 0.022"
            numOctaves="5"
            seed="4"
            result="folds"
          />
          <feDiffuseLighting in="folds" lightingColor="#fff6e8" surfaceScale="5.5" result="lit">
            <feDistantLight azimuth="145" elevation="32" />
          </feDiffuseLighting>
        </filter>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </div>
  )
}

type Star = {
  x: number
  y: number
  r: number
  opacity: number
  duration: number
  delay: number
  glow: boolean
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PAGE_STARS: Star[] = (() => {
  const rand = mulberry32(0x5a17a1)
  return Array.from({ length: 120 }, () => {
    const r = rand
    const glow = r() < 0.18
    return {
      x: r() * 100,
      y: r() * 100,
      r: glow ? 1.9 + r() * 1.5 : 1.15 + r() * 1.2,
      opacity: 0.55 + r() * 0.45,
      duration: 2.2 + r() * 3.4,
      delay: r() * 4,
      glow,
    }
  })
})()

/**
 * Night-sky starfield. CSS dots (not SVG user-units) so they stay 1–3px on a
 * phone preview. No mix-blend: overflow/transform on the invite shell isolates
 * the backdrop and made screen-blend stars disappear. Seeded for SSR.
 */
function StarsOverlay({ opacity }: { opacity: number }) {
  return (
    <div
      aria-hidden
      data-texture-type="stars"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
        overflow: 'hidden',
        opacity,
      }}
    >
      <style>{`
        @keyframes fern-star-twinkle {
          0% { opacity: calc(var(--star-base, 1) * 0.45); }
          100% { opacity: var(--star-base, 1); }
        }
        .fern-page-star {
          position: absolute;
          border-radius: 50%;
          background: #FFF8EC;
          animation-name: fern-star-twinkle;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          animation-direction: alternate;
        }
        @media (prefers-reduced-motion: reduce) {
          .fern-page-star { animation: none; opacity: var(--star-base, 1); }
        }
      `}</style>
      {PAGE_STARS.map((star, i) => (
        <span
          key={i}
          className="fern-page-star"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.r * 2,
            height: star.r * 2,
            marginLeft: -star.r,
            marginTop: -star.r,
            ['--star-base' as string]: String(star.opacity),
            boxShadow: star.glow
              ? `0 0 ${star.r * 5}px ${star.r * 1.6}px rgba(255, 248, 236, 0.9)`
              : `0 0 ${star.r * 2}px ${star.r * 0.5}px rgba(255, 248, 236, 0.65)`,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

/**
 * Photographed crumpled sheet, blended over the page colour so folds keep
 * their highlights and valleys. Named texture — not a host-supplied URL.
 */
function CrumpledPaperOverlay({ opacity }: { opacity: number }) {
  return (
    <div
      aria-hidden
      data-texture-type="crumpled-paper"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
        overflow: 'hidden',
        opacity,
        mixBlendMode: 'multiply',
        filter: 'contrast(1.15)',
        backgroundImage: 'url(/textures/crumpled-paper.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    />
  )
}

/**
 * CSS-based texture overlay that sits underneath all content.
 * When imageUrl is set (legacy saved configs), can render an image texture
 * (overlay or replace CSS texture). Hosts pick named types only.
 */
export default function TextureOverlay({ type, intensity = 40, imageUrl, textureBlend = 'overlay' }: TextureOverlayProps) {
  const opacity = intensity / 100
  const showCssTexture = type !== 'none' && (!imageUrl || textureBlend !== 'replace')
  const showImageTexture = !!imageUrl

  if (!showCssTexture && !showImageTexture) {
    return null
  }

  if (type === 'grain' && showCssTexture) {
    return <GrainOverlay opacity={opacity} />
  }

  if (type === 'stars') {
    return <StarsOverlay opacity={opacity} />
  }

  if (type === 'stone') {
    return <StoneOverlay opacity={opacity} />
  }

  if (type === 'crumpled-paper') {
    return <CrumpledPaperOverlay opacity={opacity} />
  }

  if (showImageTexture && (textureBlend === 'replace' || !showCssTexture)) {
    return (
      <div
        aria-hidden
        data-texture-type="image"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1,
          opacity,
        }}
      >
        <img
          src={imageUrl}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>
    )
  }

  // Base styles for all textures
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 1, // Behind all content but above background
    opacity,
    // No blend mode - use direct opacity for better visibility
  }

  // Texture-specific styles
  const getTextureStyle = (): React.CSSProperties => {
    switch (type) {
      case 'paper-grain':
        return {
          ...baseStyle,
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              rgba(0, 0, 0, 0.4) 0px,
              transparent 0.5px,
              transparent 1.5px,
              rgba(0, 0, 0, 0.4) 2px,
              transparent 2.5px
            ),
            repeating-linear-gradient(
              90deg,
              rgba(0, 0, 0, 0.4) 0px,
              transparent 0.5px,
              transparent 1.5px,
              rgba(0, 0, 0, 0.4) 2px,
              transparent 2.5px
            )
          `,
          backgroundSize: '3px 3px',
        }

      case 'linen':
        return {
          ...baseStyle,
          backgroundImage: `
            repeating-linear-gradient(
              45deg,
              rgba(0, 0, 0, 0.25) 0px,
              transparent 1px,
              transparent 2px,
              rgba(0, 0, 0, 0.25) 3px,
              transparent 4px
            ),
            repeating-linear-gradient(
              -45deg,
              rgba(0, 0, 0, 0.25) 0px,
              transparent 1px,
              transparent 2px,
              rgba(0, 0, 0, 0.25) 3px,
              transparent 4px
            )
          `,
          backgroundSize: '8px 8px',
        }

      case 'canvas':
        return {
          ...baseStyle,
          backgroundImage: `
            radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.5) 0.5px, transparent 0.5px),
            radial-gradient(circle at 2px 2px, rgba(0, 0, 0, 0.3) 0.5px, transparent 0.5px),
            radial-gradient(circle at 3px 3px, rgba(0, 0, 0, 0.4) 0.5px, transparent 0.5px)
          `,
          backgroundSize: '4px 4px',
        }

      case 'parchment':
        return {
          ...baseStyle,
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              rgba(139, 90, 43, 0.3) 0px,
              transparent 1px,
              transparent 2px,
              rgba(139, 90, 43, 0.3) 3px
            ),
            repeating-linear-gradient(
              90deg,
              rgba(139, 90, 43, 0.3) 0px,
              transparent 1px,
              transparent 2px,
              rgba(139, 90, 43, 0.3) 3px
            ),
            radial-gradient(circle at 50% 50%, rgba(139, 90, 43, 0.15) 0%, transparent 50%)
          `,
          backgroundSize: '6px 6px, 6px 6px, 20px 20px',
        }

      case 'vintage-paper':
        return {
          ...baseStyle,
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              rgba(101, 67, 33, 0.35) 0px,
              transparent 1px,
              transparent 3px,
              rgba(101, 67, 33, 0.35) 4px
            ),
            repeating-linear-gradient(
              90deg,
              rgba(101, 67, 33, 0.35) 0px,
              transparent 1px,
              transparent 3px,
              rgba(101, 67, 33, 0.35) 4px
            ),
            radial-gradient(circle at 2px 2px, rgba(101, 67, 33, 0.2) 1px, transparent 0)
          `,
          backgroundSize: '8px 8px, 8px 8px, 4px 4px',
        }

      case 'silk':
        return {
          ...baseStyle,
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              rgba(0, 0, 0, 0.2) 0px,
              transparent 1px,
              transparent 2px,
              rgba(0, 0, 0, 0.2) 3px
            ),
            repeating-linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.25) 0px,
              transparent 1px,
              transparent 2px,
              rgba(255, 255, 255, 0.25) 3px
            )
          `,
          backgroundSize: '2px 2px',
        }

      case 'marble':
        return {
          ...baseStyle,
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(0, 0, 0, 0.25) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(0, 0, 0, 0.25) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0.15) 0%, transparent 50%),
            repeating-linear-gradient(
              45deg,
              rgba(0, 0, 0, 0.15) 0px,
              transparent 2px,
              transparent 4px,
              rgba(0, 0, 0, 0.15) 6px
            )
          `,
          backgroundSize: '100% 100%, 100% 100%, 100% 100%, 10px 10px',
        }

      default:
        return baseStyle
    }
  }

  const textureStyle = getTextureStyle()

  return (
    <>
      {showCssTexture && <div style={textureStyle} aria-hidden data-texture-type={type} />}
      {showImageTexture && (
        <div
          aria-hidden
          data-texture-type="image"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1,
            opacity,
          }}
        >
          <img
            src={imageUrl}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      )}
    </>
  )
}
