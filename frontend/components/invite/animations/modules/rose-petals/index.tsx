'use client'

/**
 * Invite experience: soft rose petals drifting across the viewport.
 * Density, colors, and timing are owned here — hosts only select this module.
 */

import React, { useEffect, useMemo, useState } from 'react'
import type { ExperienceModuleProps } from '@/lib/invite/animations/types'

const PETAL_COLORS = ['#F7E7D3', '#F4D6D0', '#C9A0A0', '#D4A574'] as const
const PETAL_COUNT = 42

type PetalConfig = {
  id: number
  left: number
  size: number
  duration: number
  delay: number
  drift: number
  sway: number
  spinStart: number
  spinMid: number
  spinMid2: number
  spinEnd: number
  tumbleDuration: number
  color: string
  shape: 0 | 1 | 2
  opacity: number
}

/** Tiny deterministic PRNG so hydration stays stable while paths feel irregular. */
function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function buildPetals(): PetalConfig[] {
  const rand = mulberry32(0x9e3779b9)

  return Array.from({ length: PETAL_COUNT }, (_, i) => {
    const r = () => rand()
    const left = r() * 108 - 4
    const size = 11 + r() * 20
    // Keep fall speeds in a band so evenly spaced phases stay readable as a stream.
    const duration = 11 + r() * 7
    // Even phase across the loop (+ small jitter) so the screen is never empty
    // between "showers" — random delays alone tend to clump.
    const phase = (i + r() * 0.45) / PETAL_COUNT
    const delay = -(phase * duration)
    const drift = (40 + r() * 120) * (r() < 0.5 ? -1 : 1)
    const sway = (50 + r() * 100) * (r() < 0.5 ? -1 : 1)
    const spinStart = r() * 360
    const spinEnd = spinStart + (180 + r() * 540) * (r() < 0.5 ? -1 : 1)
    const spinMid = spinStart + (spinEnd - spinStart) * (0.25 + r() * 0.2)
    const spinMid2 = spinStart + (spinEnd - spinStart) * (0.55 + r() * 0.2)

    return {
      id: i,
      left,
      size,
      duration,
      delay,
      drift,
      sway,
      spinStart,
      spinMid,
      spinMid2,
      spinEnd,
      tumbleDuration: 3.5 + r() * 5,
      color: PETAL_COLORS[Math.floor(r() * PETAL_COLORS.length)],
      shape: Math.floor(r() * 3) as 0 | 1 | 2,
      opacity: 0.5 + r() * 0.35,
    }
  })
}

function PetalSvg({ shape, color }: { shape: 0 | 1 | 2; color: string }) {
  if (shape === 1) {
    return (
      <svg viewBox="0 0 24 32" width="100%" height="100%" aria-hidden>
        <path
          d="M12 2 C6 8 3 16 12 30 C21 16 18 8 12 2 Z"
          fill={color}
        />
        <path
          d="M12 6 C10 12 10 18 12 26"
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth="0.8"
        />
      </svg>
    )
  }
  if (shape === 2) {
    return (
      <svg viewBox="0 0 24 32" width="100%" height="100%" aria-hidden>
        <path
          d="M12 1 C4 10 5 20 12 31 C19 20 20 10 12 1 Z"
          fill={color}
        />
        <ellipse cx="10" cy="12" rx="3" ry="5" fill="rgba(255,255,255,0.25)" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 32" width="100%" height="100%" aria-hidden>
      <path
        d="M12 2 C8 6 4 14 8 24 C10 28 12 30 12 30 C12 30 14 28 16 24 C20 14 16 6 12 2 Z"
        fill={color}
      />
      <path
        d="M12 5 C11 12 11 20 12 28"
        fill="none"
        stroke="rgba(0,0,0,0.1)"
        strokeWidth="0.7"
      />
    </svg>
  )
}

export default function RosePetalsModule(_props: ExperienceModuleProps) {
  const petals = useMemo(() => buildPetals(), [])
  const [reducedMotion, setReducedMotion] = useState(false)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotion = () => setReducedMotion(mq.matches)
    syncMotion()
    mq.addEventListener?.('change', syncMotion)

    const onVisibility = () => setPaused(document.visibilityState === 'hidden')
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      mq.removeEventListener?.('change', syncMotion)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  if (reducedMotion) return null

  return (
    <>
      <style>{`
        @keyframes fern-petal-fall {
          /* Y advances evenly with time so fall speed stays constant.
             X/sway and spin carry the randomness — not easing. */
          0% {
            transform: translate3d(0, -14vh, 0) rotate(var(--petal-spin-start));
            opacity: 0;
          }
          5% { opacity: 1; }
          25% {
            transform: translate3d(var(--petal-sway), 17.5vh, 0) rotate(var(--petal-spin-mid));
          }
          50% {
            transform: translate3d(calc(var(--petal-sway) * -0.35), 49vh, 0) rotate(var(--petal-spin-mid2));
          }
          75% {
            transform: translate3d(calc(var(--petal-drift) * 0.55), 80.5vh, 0) rotate(var(--petal-spin-end));
          }
          92% { opacity: 1; }
          100% {
            transform: translate3d(var(--petal-drift), 112vh, 0) rotate(var(--petal-spin-end));
            opacity: 0;
          }
        }
        @keyframes fern-petal-tumble {
          0% { transform: rotateY(0deg) rotateZ(0deg); }
          50% { transform: rotateY(30deg) rotateZ(10deg); }
          100% { transform: rotateY(-24deg) rotateZ(-8deg); }
        }
        .fern-petal {
          position: absolute;
          top: 0;
          will-change: transform, opacity;
          animation-name: fern-petal-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .fern-petal-inner {
          width: 100%;
          height: 100%;
          animation-name: fern-petal-tumble;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          animation-direction: alternate;
        }
        .fern-petals-paused .fern-petal,
        .fern-petals-paused .fern-petal-inner {
          animation-play-state: paused;
        }
      `}</style>
      <div
        className={`pointer-events-none fixed inset-0 overflow-hidden${paused ? ' fern-petals-paused' : ''}`}
        style={{ zIndex: 20 }}
        aria-hidden
      >
        {petals.map((petal) => (
          <div
            key={petal.id}
            className="fern-petal"
            style={{
              left: `${petal.left}%`,
              width: petal.size,
              height: petal.size * 1.35,
              opacity: petal.opacity,
              animationDuration: `${petal.duration}s`,
              animationDelay: `${petal.delay}s`,
              ['--petal-drift' as string]: `${petal.drift}px`,
              ['--petal-sway' as string]: `${petal.sway}px`,
              ['--petal-spin-start' as string]: `${petal.spinStart}deg`,
              ['--petal-spin-mid' as string]: `${petal.spinMid}deg`,
              ['--petal-spin-mid2' as string]: `${petal.spinMid2}deg`,
              ['--petal-spin-end' as string]: `${petal.spinEnd}deg`,
            }}
          >
            <div
              className="fern-petal-inner"
              style={{ animationDuration: `${petal.tumbleDuration}s` }}
            >
              <PetalSvg shape={petal.shape} color={petal.color} />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
