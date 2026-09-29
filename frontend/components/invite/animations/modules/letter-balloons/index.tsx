'use client'

/**
 * Invite experience: pastel balloons carrying Marathi letters float up the
 * sides of the invite. Tapping one on open space makes the letter drop off and
 * the balloon zip away like it sprang a leak, with a squeaky "pffffrrt".
 *
 * The overlay never takes pointer events. Taps reach the invite first, and a
 * document listener lets a balloon go only when the tap was not on a link,
 * button or field (see isInteractiveTarget). Hosts only select this module.
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ExperienceModuleProps } from '@/lib/invite/animations/types'
import {
  BALLOON_ASPECT,
  BALLOON_BODY_CENTER_Y,
  BALLOON_KNOT_Y,
  BALLOON_LETTERS,
  BALLOON_LETTER_BASELINE_Y,
  BALLOON_LETTER_SIZE,
  buildBalloons,
  isInteractiveTarget,
  isPointInBalloon,
  mulberry32,
  type BalloonConfig,
  type BalloonPalette,
} from '@/lib/invite/animations/letterBalloons'
import { playLeak, playTok } from './sound'

const BALLOON_COUNT = 14
const RESPAWN_MS = 2600
const LETTER_FONT = "'Baloo 2', 'Noto Sans Devanagari', 'Nunito', sans-serif"
// Only the nine glyphs are requested, so the font download is a few KB.
const FONT_HREF = `https://fonts.googleapis.com/css2?family=Baloo+2:wght@800&text=${encodeURIComponent(
  BALLOON_LETTERS.join(''),
)}&display=swap`

const STAR_COLORS = ['#FFD447', '#FFB4C8', '#FFFFFF', '#9FE3FF'] as const

type Slot = { gen: number; fresh: boolean; gone: boolean }

function BalloonSvg({ palette, letter }: { palette: BalloonPalette; letter: string | null }) {
  const gradId = `${useId().replace(/:/g, '')}-balloon`
  return (
    <svg viewBox="0 0 60 104" width="100%" height="100%" aria-hidden style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={gradId} cx="38%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="35%" stopColor={palette.body} />
          <stop offset="100%" stopColor={palette.shade} />
        </radialGradient>
      </defs>
      <path
        d="M30 70 C24 78 36 84 29 92 C25 97 31 101 30 104"
        fill="none"
        stroke={palette.shade}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M30 4 C14 4 4 17 4 33 C4 50 17 63 30 68 C43 63 56 50 56 33 C56 17 46 4 30 4 Z"
        fill={`url(#${gradId})`}
      />
      <path d="M26 71 L34 71 L30 66 Z" fill={palette.shade} />
      <ellipse cx="18" cy="19" rx="4.5" ry="8.5" fill="#FFFFFF" opacity="0.5" transform="rotate(-24 18 19)" />
      {letter && (
        <text
          x="30"
          y="44"
          textAnchor="middle"
          fontFamily={LETTER_FONT}
          fontWeight={800}
          fontSize="25"
          fill={palette.ink}
        >
          {letter}
        </text>
      )}
    </svg>
  )
}

function Star({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
      <path
        d="M12 1.5 L14.6 8.6 L22.2 9 L16.2 13.7 L18.3 21 L12 16.8 L5.7 21 L7.8 13.7 L1.8 9 L9.4 8.6 Z"
        fill={color}
        stroke="rgba(0,0,0,0.12)"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PaperPlane() {
  return (
    <svg viewBox="0 0 34 24" width="100%" height="100%" aria-hidden>
      <path d="M1 12 L33 2 L20 22 L15 14 Z" fill="#FFFFFF" stroke="#8A94B8" strokeWidth="1" strokeLinejoin="round" />
      <path d="M15 14 L33 2" stroke="#8A94B8" strokeWidth="1" fill="none" />
      <path d="M15 14 L14 20 L18 17" fill="#DDE3F5" stroke="#8A94B8" strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  )
}

/** Deflated-balloon art for the imperative leak effect (no React root there). */
function balloonMarkup(palette: BalloonPalette, uid: string): string {
  return (
    `<svg viewBox="0 0 60 104" width="100%" height="100%" aria-hidden="true" style="overflow:visible">` +
    `<defs><radialGradient id="${uid}" cx="38%" cy="30%" r="70%">` +
    `<stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.55"/>` +
    `<stop offset="35%" stop-color="${palette.body}"/>` +
    `<stop offset="100%" stop-color="${palette.shade}"/></radialGradient></defs>` +
    `<path d="M30 70 C24 78 36 84 29 92 C25 97 31 101 30 104" fill="none" stroke="${palette.shade}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M30 4 C14 4 4 17 4 33 C4 50 17 63 30 68 C43 63 56 50 56 33 C56 17 46 4 30 4 Z" fill="url(#${uid})"/>` +
    `<path d="M26 71 L34 71 L30 66 Z" fill="${palette.shade}"/>` +
    `<ellipse cx="18" cy="19" rx="4.5" ry="8.5" fill="#FFFFFF" opacity="0.5" transform="rotate(-24 18 19)"/>` +
    `</svg>`
  )
}

export default function LetterBalloonsModule(_props: ExperienceModuleProps) {
  const balloons = useMemo(() => buildBalloons(BALLOON_COUNT), [])
  const decor = useMemo(() => {
    const rand = mulberry32(0x5741a2)
    const stars = Array.from({ length: 7 }, (_, i) => ({
      id: i,
      size: 10 + rand() * 10,
      left: i % 2 === 0 ? 3 + rand() * 18 : 78 + rand() * 18,
      top: 4 + rand() * 88,
      duration: 1.4 + rand() * 1.6,
      delay: -rand() * 3,
      color: STAR_COLORS[i % STAR_COLORS.length],
    }))
    return { stars }
  }, [])

  const overlayRef = useRef<HTMLDivElement>(null)
  const effectsRef = useRef<HTMLDivElement>(null)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const frames = useRef(new Set<number>())
  const uidPrefix = useId().replace(/:/g, '')
  const uidCounter = useRef(0)

  const [box, setBox] = useState({ width: 0, height: 0 })
  const [slots, setSlots] = useState<Slot[]>(() =>
    balloons.map(() => ({ gen: 0, fresh: false, gone: false })),
  )
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

    const timerSet = timers.current
    const frameSet = frames.current
    return () => {
      mq.removeEventListener?.('change', syncMotion)
      document.removeEventListener('visibilitychange', onVisibility)
      timerSet.forEach(clearTimeout)
      frameSet.forEach(cancelAnimationFrame)
    }
  }, [])

  // Measure the overlay itself: inside the editor's phone shell it is the
  // phone screen, not the browser viewport.
  useEffect(() => {
    const el = overlayRef.current
    if (!el) return
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id)
      fn()
    }, ms)
    timers.current.add(id)
  }, [])

  const spawnPuff = useCallback((x: number, y: number) => {
    const host = effectsRef.current
    if (!host) return
    const d = document.createElement('div')
    d.className = 'fern-balloon-puff'
    d.style.left = `${x.toFixed(1)}px`
    d.style.top = `${y.toFixed(1)}px`
    host.appendChild(d)
    d.addEventListener('animationend', () => d.remove())
  }, [])

  const dropLetter = useCallback(
    (b: BalloonConfig, cx: number, top: number, height: number, overlayH: number) => {
      const host = effectsRef.current
      if (!host) return
      const fs = b.size * BALLOON_LETTER_SIZE
      const el = document.createElement('div')
      el.className = 'fern-balloon-letter'
      el.textContent = b.letter
      el.style.color = b.palette.ink
      el.style.fontSize = `${fs.toFixed(1)}px`
      el.style.width = `${b.size.toFixed(0)}px`
      el.style.left = `${(cx - b.size / 2).toFixed(1)}px`
      const letterTop = top + height * BALLOON_LETTER_BASELINE_Y - fs * 0.82
      el.style.top = `${letterTop.toFixed(1)}px`
      host.appendChild(el)

      const fall = Math.max(40, overlayH - letterTop - fs * 1.1 - 10)
      const dx = Math.random() * 44 - 22
      const rot = Math.random() * 90 - 45
      const at = (x: number, y: number, r: number) =>
        `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r.toFixed(1)}deg)`
      const anim = el.animate(
        [
          { transform: at(0, 0, 0), opacity: 1, easing: 'cubic-bezier(0.45, 0, 0.95, 0.55)' },
          { transform: at(dx * 0.8, fall, rot), opacity: 1, offset: 0.55, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)' },
          { transform: at(dx * 0.92, fall - 26, rot * 1.15), opacity: 1, offset: 0.68, easing: 'cubic-bezier(0.6, 0, 0.9, 0.5)' },
          { transform: at(dx, fall, rot * 1.25), opacity: 1, offset: 0.8 },
          { transform: at(dx, fall, rot * 1.25), opacity: 0 },
        ],
        { duration: 1900, fill: 'forwards' },
      )
      anim.onfinish = () => el.remove()
      // Landing at 55% of the fall, the small bounce lands at 80%.
      playTok(1.9 * 0.55, 1)
      playTok(1.9 * 0.8, 0.45)
    },
    [],
  )

  const leakAway = useCallback(
    (b: BalloonConfig, cx: number, top: number, height: number, overlayW: number, overlayH: number) => {
      const host = effectsRef.current
      if (!host) return
      const el = document.createElement('div')
      el.className = 'fern-balloon-leaking'
      el.style.width = `${b.size.toFixed(0)}px`
      el.style.height = `${height.toFixed(0)}px`
      el.style.left = `${(cx - b.size / 2).toFixed(1)}px`
      el.style.top = `${top.toFixed(1)}px`
      el.innerHTML = balloonMarkup(b.palette, `${uidPrefix}-leak-${uidCounter.current++}`)
      host.appendChild(el)

      // Pivot = body centre; air escapes from the knot below it.
      const pivotX = cx
      const pivotY = top + height * BALLOON_BODY_CENTER_Y
      const knotOffset = height * (BALLOON_KNOT_Y - BALLOON_BODY_CENTER_Y)
      let px = 0
      let py = 0
      let heading = -Math.PI / 2 + (Math.random() - 0.5) * 1.2
      let turn = (Math.random() - 0.5) * 8
      const speed = 560 + Math.random() * 220
      const life = 1350 + Math.random() * 300
      let t0: number | null = null
      let last = 0
      let lastPuff = 0
      playLeak(life / 1000)

      const frame = (now: number) => {
        if (t0 === null) {
          t0 = now
          last = now
        }
        const dt = Math.min(0.05, (now - last) / 1000)
        last = now
        const prog = Math.min(1, (now - t0) / life)

        // Erratic thrust: the turn rate itself wanders, like a real leaking balloon.
        turn = Math.max(-11, Math.min(11, turn + (Math.random() - 0.5) * 70 * dt))
        heading += turn * dt
        const sp = speed * (1 - 0.45 * prog)
        px += Math.cos(heading) * sp * dt
        py += Math.sin(heading) * sp * dt

        // Keep it on screen so the guest can watch it: bounce off the edges.
        const ax = pivotX + px
        const ay = pivotY + py
        if (ax < 12 || ax > overlayW - 12) {
          heading = Math.PI - heading
          px = Math.max(12, Math.min(overlayW - 12, ax)) - pivotX
        }
        if (ay < 12 || ay > overlayH - 12) {
          heading = -heading
          py = Math.max(12, Math.min(overlayH - 12, ay)) - pivotY
        }

        const scale = 1 - 0.72 * Math.pow(prog, 1.1)
        const flutter = Math.sin((now - t0) / 22) * 9 * (1 - prog * 0.5)
        const rotDeg = (heading * 180) / Math.PI + 90 + flutter
        el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) rotate(${rotDeg.toFixed(1)}deg) scale(${scale.toFixed(3)})`
        el.style.opacity = prog > 0.82 ? ((1 - prog) / 0.18).toFixed(2) : '1'

        if (now - lastPuff > 40 && prog < 0.9) {
          lastPuff = now
          const r = (rotDeg * Math.PI) / 180
          const ko = knotOffset * scale
          spawnPuff(pivotX + px - Math.sin(r) * ko, pivotY + py + Math.cos(r) * ko)
        }

        if (prog < 1) {
          const id = requestAnimationFrame(frame)
          frames.current.add(id)
        } else {
          el.remove()
        }
      }
      const id = requestAnimationFrame(frame)
      frames.current.add(id)
    },
    [spawnPuff, uidPrefix],
  )

  const letGo = useCallback(
    (index: number, rect: DOMRect, overlayRect: DOMRect) => {
      const b = balloons[index]
      const height = b.size * BALLOON_ASPECT
      const cx = rect.left + rect.width / 2 - overlayRect.left
      const top = rect.top + (rect.height - height) / 2 - overlayRect.top

      setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, gone: true } : s)))
      if (!reducedMotion) {
        dropLetter(b, cx, top, height, overlayRect.height)
        leakAway(b, cx, top, height, overlayRect.width, overlayRect.height)
      }
      // A fresh balloon floats up from the bottom a little later.
      later(() => {
        setSlots((prev) =>
          prev.map((s, i) => (i === index ? { gen: s.gen + 1, fresh: true, gone: false } : s)),
        )
      }, RESPAWN_MS)
    },
    [balloons, dropLetter, leakAway, later, reducedMotion],
  )

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Links, buttons and fields always win: a tap there never touches a balloon.
      if (isInteractiveTarget(e.target)) return
      const overlay = overlayRef.current
      if (!overlay) return
      const overlayRect = overlay.getBoundingClientRect()
      if (
        e.clientX < overlayRect.left ||
        e.clientX > overlayRect.right ||
        e.clientY < overlayRect.top ||
        e.clientY > overlayRect.bottom
      ) {
        return
      }
      const nodes = overlay.querySelectorAll<HTMLElement>('[data-balloon-index]')
      for (let i = nodes.length - 1; i >= 0; i--) {
        const inner = nodes[i].firstElementChild as HTMLElement | null
        if (!inner) continue
        const rect = inner.getBoundingClientRect()
        if (isPointInBalloon(e.clientX, e.clientY, rect)) {
          letGo(Number(nodes[i].dataset.balloonIndex), rect, overlayRect)
          return
        }
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [letGo])

  const ready = box.height > 0

  return (
    <>
      <link rel="stylesheet" href={FONT_HREF} />
      <style>{`
        @keyframes fern-balloon-rise {
          0%   { transform: translate3d(0, var(--balloon-start), 0) rotate(var(--balloon-tilt-start)); opacity: 0; }
          6%   { opacity: 1; }
          30%  { transform: translate3d(var(--balloon-sway), calc(var(--balloon-start) * 0.68), 0) rotate(var(--balloon-tilt-end)); }
          58%  { transform: translate3d(calc(var(--balloon-sway) * -0.5), calc(var(--balloon-start) * 0.36), 0) rotate(var(--balloon-tilt-start)); }
          94%  { opacity: 1; }
          100% { transform: translate3d(var(--balloon-drift), -150px, 0) rotate(var(--balloon-tilt-end)); opacity: 0; }
        }
        @keyframes fern-balloon-bob {
          0%   { transform: rotate(-4deg) translateY(0); }
          100% { transform: rotate(4deg) translateY(-6px); }
        }
        @keyframes fern-balloon-twinkle {
          0%   { transform: scale(0.55) rotate(0deg); opacity: 0.25; }
          100% { transform: scale(1.05) rotate(18deg); opacity: 1; }
        }
        @keyframes fern-balloon-plane {
          0%   { transform: translate3d(-60px, 0, 0) rotate(-8deg); opacity: 0; }
          8%   { opacity: 0.95; }
          50%  { transform: translate3d(calc(var(--balloon-width) * 0.5), -26px, 0) rotate(4deg); }
          92%  { opacity: 0.95; }
          100% { transform: translate3d(calc(var(--balloon-width) + 60px), 10px, 0) rotate(-6deg); opacity: 0; }
        }
        @keyframes fern-balloon-puff-out {
          from { transform: scale(0.6); opacity: 0.85; }
          to   { transform: scale(2.6); opacity: 0; }
        }
        .fern-balloons,
        .fern-balloons * {
          pointer-events: none !important;
        }
        .fern-balloon {
          position: absolute;
          top: 0;
          will-change: transform, opacity;
          animation: fern-balloon-rise linear infinite;
        }
        .fern-balloon-inner {
          width: 100%;
          height: 100%;
          transform-origin: 50% 90%;
          animation: fern-balloon-bob ease-in-out infinite alternate;
        }
        .fern-balloon-star {
          position: absolute;
          animation: fern-balloon-twinkle ease-in-out infinite alternate;
        }
        .fern-balloon-plane {
          position: absolute;
          left: 0;
          width: 34px;
          height: 24px;
          animation: fern-balloon-plane linear infinite;
        }
        .fern-balloon-leaking {
          position: absolute;
          transform-origin: 50% ${(BALLOON_BODY_CENTER_Y * 100).toFixed(1)}%;
          will-change: transform, opacity;
        }
        .fern-balloon-letter {
          position: absolute;
          text-align: center;
          font-family: ${LETTER_FONT};
          font-weight: 800;
          line-height: 1;
          will-change: transform, opacity;
        }
        .fern-balloon-puff {
          position: absolute;
          width: 7px;
          height: 7px;
          margin: -3.5px 0 0 -3.5px;
          border-radius: 50%;
          background: rgba(170, 185, 215, 0.5);
          animation: fern-balloon-puff-out 0.55s ease-out forwards;
        }
        .fern-balloons-paused .fern-balloon,
        .fern-balloons-paused .fern-balloon-inner,
        .fern-balloons-paused .fern-balloon-star,
        .fern-balloons-paused .fern-balloon-plane {
          animation-play-state: paused;
        }
        .fern-balloons-still .fern-balloon,
        .fern-balloons-still .fern-balloon-inner,
        .fern-balloons-still .fern-balloon-star {
          animation: none;
        }
        .fern-balloons-still .fern-balloon {
          transform: translate3d(0, var(--balloon-rest), 0);
        }
        .fern-balloons-still .fern-balloon-plane {
          display: none;
        }
      `}</style>
      <div
        ref={overlayRef}
        className={`fern-balloons pointer-events-none fixed inset-0 overflow-hidden${paused ? ' fern-balloons-paused' : ''}${reducedMotion ? ' fern-balloons-still' : ''}`}
        style={{ zIndex: 20, ['--balloon-width' as string]: `${box.width}px` }}
        aria-hidden
      >
        {ready &&
          decor.stars.map((s) => (
            <div
              key={`star-${s.id}`}
              className="fern-balloon-star"
              style={{
                left: `${s.left.toFixed(1)}%`,
                top: `${s.top.toFixed(1)}%`,
                width: s.size,
                height: s.size,
                animationDuration: `${s.duration.toFixed(1)}s`,
                animationDelay: `${s.delay.toFixed(1)}s`,
              }}
            >
              <Star color={s.color} />
            </div>
          ))}
        {ready &&
          [0, 1].map((k) => (
            <div
              key={`plane-${k}`}
              className="fern-balloon-plane"
              style={{
                top: `${6 + k * 9}%`,
                animationDuration: `${11 + k * 5}s`,
                animationDelay: `${-k * 6 - 2}s`,
              }}
            >
              <PaperPlane />
            </div>
          ))}
        {ready &&
          balloons.map((b, i) => {
            const slot = slots[i]
            if (slot.gone) return null
            const height = b.size * BALLOON_ASPECT
            return (
              <div
                key={`balloon-${b.id}-${slot.gen}`}
                data-balloon-index={i}
                className="fern-balloon"
                style={{
                  left: `${b.left.toFixed(1)}%`,
                  width: b.size,
                  height,
                  opacity: b.opacity,
                  animationDuration: `${b.duration.toFixed(1)}s`,
                  animationDelay: `${(slot.fresh ? 0 : b.delay).toFixed(1)}s`,
                  ['--balloon-start' as string]: `${box.height + 40}px`,
                  ['--balloon-rest' as string]: `${Math.round(b.rest * box.height)}px`,
                  ['--balloon-sway' as string]: `${b.sway.toFixed(0)}px`,
                  ['--balloon-drift' as string]: `${b.drift.toFixed(0)}px`,
                  ['--balloon-tilt-start' as string]: `${b.tiltStart.toFixed(1)}deg`,
                  ['--balloon-tilt-end' as string]: `${b.tiltEnd.toFixed(1)}deg`,
                }}
              >
                <div className="fern-balloon-inner" style={{ animationDuration: `${b.bobDuration.toFixed(1)}s` }}>
                  <BalloonSvg palette={b.palette} letter={b.letter} />
                </div>
              </div>
            )
          })}
        <div ref={effectsRef} />
      </div>
    </>
  )
}
