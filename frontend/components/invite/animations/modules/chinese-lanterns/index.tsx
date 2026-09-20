'use client'

/**
 * Invite experience: sky lanterns (孔明灯) drifting upward.
 * Warm paper cylinders lit from the flame at the open base —
 * matching the Yi Peng / lantern-festival look. Hosts only select this module.
 */

import React, { useEffect, useMemo, useState } from 'react'
import type { ExperienceModuleProps } from '@/lib/invite/animations/types'

const LANTERN_COUNT = 16

type Palette = {
  top: string
  mid: string
  hot: string
  glow: string
  rim: string
}

const PALETTES: readonly Palette[] = [
  {
    top: '#C56A18',
    mid: '#F0A830',
    hot: '#FFE7A0',
    glow: '#FFC14A',
    rim: '#8A4A12',
  },
  {
    top: '#D07820',
    mid: '#FFB44A',
    hot: '#FFF1C0',
    glow: '#FFD56A',
    rim: '#9A5414',
  },
  {
    top: '#B45C14',
    mid: '#E89828',
    hot: '#FFD878',
    glow: '#FFB43C',
    rim: '#7A4010',
  },
  {
    top: '#C8822A',
    mid: '#F4C056',
    hot: '#FFF6D0',
    glow: '#FFE08A',
    rim: '#A06018',
  },
] as const

type LanternConfig = {
  id: number
  left: number
  size: number
  duration: number
  delay: number
  drift: number
  sway: number
  tiltStart: number
  tiltMid: number
  tiltEnd: number
  wobbleDuration: number
  flameDuration: number
  palette: Palette
  topW: number
  botW: number
  detail: boolean
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

function buildLanterns(): LanternConfig[] {
  const rand = mulberry32(0xc1a4e571)

  return Array.from({ length: LANTERN_COUNT }, (_, i) => {
    const r = () => rand()
    const depth = r()
    const lane = r()
    const isCenter = lane >= 0.42 && lane < 0.58
    const left = isCenter
      ? 38 + r() * 24
      : lane < 0.42
        ? r() * 26 - 6
        : 80 + r() * 26
    const size = isCenter ? 26 + depth * 22 : 34 + depth * 48
    const duration = 18 + (1 - depth) * 10 + r() * 4
    const phase = (i + r() * 0.4) / LANTERN_COUNT
    const delay = -(phase * duration)
    const drift = (18 + r() * 56) * (r() < 0.5 ? -1 : 1)
    const sway = (22 + r() * 48) * (r() < 0.5 ? -1 : 1)
    const tiltStart = r() * 10 - 5
    const tiltEnd = tiltStart + (r() * 14 - 7)
    const tiltMid = tiltStart + (tiltEnd - tiltStart) * (0.4 + r() * 0.25)
    const topW = 17 + r() * 3.5
    const botW = topW + 1.5 + r() * 4

    return {
      id: i,
      left,
      size,
      duration,
      delay,
      drift,
      sway,
      tiltStart,
      tiltMid,
      tiltEnd,
      wobbleDuration: 3.2 + r() * 2.4,
      flameDuration: 0.28 + r() * 0.22,
      palette: PALETTES[Math.floor(r() * PALETTES.length)],
      topW,
      botW,
      detail: size >= 42,
      opacity: 0.7 + depth * 0.28,
    }
  })
}

function bodyPath(topW: number, botW: number): string {
  const cx = 40
  const top = 10
  const bot = 100
  const tl = cx - topW
  const tr = cx + topW
  const bl = cx - botW
  const br = cx + botW
  return [
    `M ${tl.toFixed(1)} ${(top + 14).toFixed(1)}`,
    `C ${tl.toFixed(1)} ${top.toFixed(1)}, ${tr.toFixed(1)} ${top.toFixed(1)}, ${tr.toFixed(1)} ${(top + 14).toFixed(1)}`,
    `C ${(tr + 1.2).toFixed(1)} 42, ${(br + 0.8).toFixed(1)} 78, ${br.toFixed(1)} ${(bot - 6).toFixed(1)}`,
    `C ${br.toFixed(1)} ${(bot + 4).toFixed(1)}, ${bl.toFixed(1)} ${(bot + 4).toFixed(1)}, ${bl.toFixed(1)} ${(bot - 6).toFixed(1)}`,
    `C ${(bl - 0.8).toFixed(1)} 78, ${(tl - 1.2).toFixed(1)} 42, ${tl.toFixed(1)} ${(top + 14).toFixed(1)}`,
    'Z',
  ].join(' ')
}

function LanternSvg({
  uid,
  palette,
  topW,
  botW,
  detail,
  flameDuration,
}: {
  uid: string
  palette: Palette
  topW: number
  botW: number
  detail: boolean
  flameDuration: number
}) {
  const vert = `${uid}-vert`
  const cyl = `${uid}-cyl`
  const fire = `${uid}-fire`
  const opening = `${uid}-open`
  const d = bodyPath(topW, botW)
  const openRx = botW - 2.2
  const openRy = 6.4

  return (
    <svg viewBox="0 0 80 120" width="100%" height="100%" aria-hidden style={{ pointerEvents: 'none' }}>
      <defs>
        <linearGradient id={vert} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor={palette.top} />
          <stop offset="38%" stopColor={palette.mid} />
          <stop offset="72%" stopColor={palette.hot} />
          <stop offset="100%" stopColor="#FFF8D8" />
        </linearGradient>
        <linearGradient id={cyl} x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0%" stopColor="#4A2208" stopOpacity="0.38" />
          <stop offset="18%" stopColor="#FFF6D0" stopOpacity="0.14" />
          <stop offset="48%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="82%" stopColor="#FFF6D0" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#3A1806" stopOpacity="0.4" />
        </linearGradient>
        <radialGradient id={fire} cx="50%" cy="78%" r="55%">
          <stop offset="0%" stopColor="#FFFCE8" />
          <stop offset="35%" stopColor="#FFE08A" />
          <stop offset="100%" stopColor="#FF9A2A" stopOpacity="0.15" />
        </radialGradient>
        <radialGradient id={opening} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#FFF6C4" />
          <stop offset="55%" stopColor="#FFB84A" />
          <stop offset="100%" stopColor="#7A3A0C" />
        </radialGradient>
      </defs>

      <ellipse cx="40" cy="62" rx="36" ry="48" fill={palette.glow} opacity="0.22" />

      <path d={d} fill={`url(#${vert})`} />
      <path d={d} fill={`url(#${cyl})`} />

      {/* Paper cap — dimmer, same sheet gathered at the top */}
      <ellipse cx="40" cy="16" rx={topW - 1} ry="7.2" fill={palette.top} opacity="0.35" />
      <ellipse cx="40" cy="14.5" rx={topW - 3} ry="3.4" fill="#F8D48A" opacity="0.18" />

      {detail && (
        <g fill="none" stroke={palette.rim} strokeOpacity="0.12" strokeWidth="0.7">
          <path d={`M ${(40 - topW * 0.45).toFixed(1)} 28 C 28 52, 27 76, ${(40 - botW * 0.35).toFixed(1)} 94`} />
          <path d={`M ${(40 + topW * 0.2).toFixed(1)} 26 C 44 50, 45 74, ${(40 + botW * 0.15).toFixed(1)} 92`} />
        </g>
      )}

      {/* Open base: looking slightly up into the lit interior */}
      <ellipse cx="40" cy="100" rx={openRx} ry={openRy} fill={palette.rim} />
      <ellipse cx="40" cy="98.6" rx={openRx - 2.4} ry={openRy - 1.8} fill={`url(#${opening})`} />
      <ellipse
        cx="40"
        cy="102.2"
        rx={openRx}
        ry="2.4"
        fill="none"
        stroke={palette.hot}
        strokeWidth="1.1"
        opacity="0.45"
      />

      <g className="fern-lantern-flame" style={{ animationDuration: `${flameDuration}s` }}>
        <ellipse cx="40" cy="98" rx="10" ry="7" fill={palette.glow} opacity="0.55" />
        <path d="M40 90 C35.5 96 36 104 40 108 C44 104 44.5 96 40 90 Z" fill={`url(#${fire})`} />
        <path d="M40 93 C38 97 38.4 102 40 105 C41.6 102 42 97 40 93 Z" fill="#FFFCE8" />
      </g>
    </svg>
  )
}

export default function ChineseLanternsModule(_props: ExperienceModuleProps) {
  const lanterns = useMemo(() => buildLanterns(), [])
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
        @keyframes fern-lantern-rise {
          0% {
            transform: translate3d(0, 118vh, 0) rotate(var(--lantern-tilt-start));
            opacity: 0;
          }
          7% { opacity: 1; }
          28% {
            transform: translate3d(var(--lantern-sway), 82vh, 0) rotate(var(--lantern-tilt-mid));
          }
          52% {
            transform: translate3d(calc(var(--lantern-sway) * -0.45), 48vh, 0) rotate(var(--lantern-tilt-start));
          }
          76% {
            transform: translate3d(calc(var(--lantern-drift) * 0.55), 18vh, 0) rotate(var(--lantern-tilt-end));
          }
          93% { opacity: 1; }
          100% {
            transform: translate3d(var(--lantern-drift), -28vh, 0) rotate(var(--lantern-tilt-end));
            opacity: 0;
          }
        }
        @keyframes fern-lantern-wobble {
          0% { transform: rotate(-2.4deg) translateX(-2px); }
          50% { transform: rotate(2.8deg) translateX(4px); }
          100% { transform: rotate(-1.8deg) translateX(-2px); }
        }
        @keyframes fern-lantern-flame-flicker {
          0% { transform: scale(1, 1); opacity: 0.92; }
          100% { transform: scale(0.88, 1.16); opacity: 1; }
        }
        @keyframes fern-lantern-halo-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0.95; transform: scale(1.08); }
        }
        .fern-lantern,
        .fern-lantern * {
          pointer-events: none !important;
        }
        .fern-lantern {
          position: absolute;
          top: 0;
          will-change: transform, opacity;
          animation-name: fern-lantern-rise;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .fern-lantern-inner {
          width: 100%;
          height: 100%;
          animation-name: fern-lantern-wobble;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          animation-direction: alternate;
        }
        .fern-lantern-halo {
          position: absolute;
          left: -32%;
          top: 6%;
          width: 164%;
          height: 88%;
          border-radius: 50%;
          pointer-events: none;
          animation-name: fern-lantern-halo-pulse;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        .fern-lantern-flame {
          transform-box: fill-box;
          transform-origin: 50% 85%;
          animation-name: fern-lantern-flame-flicker;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          animation-direction: alternate;
        }
        .fern-lanterns-paused .fern-lantern,
        .fern-lanterns-paused .fern-lantern-inner,
        .fern-lanterns-paused .fern-lantern-halo,
        .fern-lanterns-paused .fern-lantern-flame {
          animation-play-state: paused;
        }
      `}</style>
      <div
        className={`pointer-events-none fixed inset-0 overflow-hidden${paused ? ' fern-lanterns-paused' : ''}`}
        style={{ zIndex: 20 }}
        aria-hidden
      >
        {lanterns.map((lantern) => (
          <div
            key={lantern.id}
            className="fern-lantern"
            style={{
              left: `${lantern.left}%`,
              width: lantern.size,
              height: lantern.size * 1.5,
              opacity: lantern.opacity,
              animationDuration: `${lantern.duration}s`,
              animationDelay: `${lantern.delay}s`,
              ['--lantern-drift' as string]: `${lantern.drift}px`,
              ['--lantern-sway' as string]: `${lantern.sway}px`,
              ['--lantern-tilt-start' as string]: `${lantern.tiltStart}deg`,
              ['--lantern-tilt-mid' as string]: `${lantern.tiltMid}deg`,
              ['--lantern-tilt-end' as string]: `${lantern.tiltEnd}deg`,
            }}
          >
            <div
              className="fern-lantern-halo"
              style={{
                background: `radial-gradient(ellipse at 50% 72%, ${lantern.palette.glow}cc 0%, ${lantern.palette.glow}55 32%, transparent 68%)`,
                animationDuration: `${2.4 + lantern.flameDuration * 4}s`,
                animationDelay: `${lantern.delay}s`,
              }}
            />
            <div
              className="fern-lantern-inner"
              style={{ animationDuration: `${lantern.wobbleDuration}s` }}
            >
              <LanternSvg
                uid={`fern-sky-${lantern.id}`}
                palette={lantern.palette}
                topW={lantern.topW}
                botW={lantern.botW}
                detail={lantern.detail}
                flameDuration={lantern.flameDuration}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
