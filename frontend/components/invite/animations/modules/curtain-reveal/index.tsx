'use client'

/**
 * Opening module: Curtain Reveal.
 * Deep red velvet curtains part from center and slowly reveal the invite.
 */

import React, { useEffect, useRef, useState } from 'react'
import type { OpeningModuleProps } from '@/lib/invite/animations/types'

const STORAGE_KEY_BASE = 'invite_opening:curtain_reveal'

function storageKey(slug?: string): string {
  return slug ? `${STORAGE_KEY_BASE}:${slug}` : STORAGE_KEY_BASE
}

function hasSeen(slug?: string): boolean {
  try {
    return localStorage.getItem(storageKey(slug)) === 'true'
  } catch {
    return false
  }
}

function markSeen(slug?: string): void {
  try {
    localStorage.setItem(storageKey(slug), 'true')
  } catch {
    // private mode / quota — non-fatal
  }
}

function clearSeen(slug?: string): void {
  try {
    localStorage.removeItem(storageKey(slug))
  } catch {
    // ignore
  }
}

function shouldForceReplay(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return (
    params.get('showAnimation') === 'true' ||
    params.get('replayOpening') === 'true'
  )
}

type Stage = 'closed' | 'opening' | 'complete'

export default function CurtainRevealModule({
  children,
  slug,
  onComplete,
}: OpeningModuleProps) {
  const [stage, setStage] = useState<Stage>('closed')
  const [showOverlay, setShowOverlay] = useState(true) // cover immediately; hide if we skip
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const finish = (opts?: { persist?: boolean }) => {
    if (completedRef.current) return
    completedRef.current = true
    setStage('complete')
    setShowOverlay(false)
    if (opts?.persist !== false) markSeen(slug)
    onCompleteRef.current()
  }

  useEffect(() => {
    let cancelled = false
    const timers: number[] = []

    const safeFinish = (opts?: { persist?: boolean }) => {
      if (cancelled) return
      finish(opts)
    }

    if (typeof window === 'undefined') {
      safeFinish({ persist: false })
      return
    }

    // Editor / preview slugs always replay; URL flags force guest replay.
    const previewSlug = typeof slug === 'string' && slug.includes('preview')
    const force = shouldForceReplay() || previewSlug
    if (force) clearSeen(slug)

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      safeFinish()
      return
    }

    if (!force && hasSeen(slug)) {
      safeFinish()
      return
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[curtain_reveal] playing', { slug, force })
    }

    completedRef.current = false
    setShowOverlay(true)
    setStage('closed')

    // Brief closed beat, then part — invite is already painted behind the panels.
    timers.push(
      window.setTimeout(() => {
        if (!cancelled) setStage('opening')
      }, 450),
    )
    timers.push(
      window.setTimeout(() => {
        safeFinish()
      }, 3600),
    )

    return () => {
      cancelled = true
      for (const id of timers) window.clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const handleSkip = () => {
    if (stage === 'complete' || !showOverlay) return
    finish()
  }

  const isOpen = stage === 'opening' || stage === 'complete'
  const contentInteractive = !showOverlay

  return (
    <>
      <style>{`
        .fern-curtain-root {
          position: relative;
          min-height: 100%;
        }
        .fern-curtain-content[data-locked="true"] {
          pointer-events: none;
        }
        .fern-curtain-stage {
          position: fixed;
          inset: 0;
          z-index: 9999;
          overflow: hidden;
          cursor: pointer;
          pointer-events: auto;
          /*
            Closed: solid velvet so one paint frame never flashes the black
            phone chrome / empty page through a transparent stage.
            Open: transparent so the invite shows in the parting gap.
          */
          background: #2a040c;
          transition: background-color 0.2s linear;
        }
        .fern-curtain-stage[data-open="true"] {
          background: transparent;
        }
        .fern-curtain-panel {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 54%;
          transition: transform 2.8s cubic-bezier(0.45, 0.05, 0.25, 1);
          will-change: transform;
          box-shadow: inset -18px 0 40px rgba(0, 0, 0, 0.45);
        }
        .fern-curtain-panel--left {
          left: 0;
          transform: translateX(0);
          border-right: 1px solid rgba(255, 215, 140, 0.25);
        }
        .fern-curtain-panel--right {
          right: 0;
          transform: translateX(0);
          box-shadow: inset 18px 0 40px rgba(0, 0, 0, 0.45);
          border-left: 1px solid rgba(255, 215, 140, 0.25);
        }
        .fern-curtain-stage[data-open="true"] .fern-curtain-panel--left {
          transform: translateX(-102%);
        }
        .fern-curtain-stage[data-open="true"] .fern-curtain-panel--right {
          transform: translateX(102%);
        }
        .fern-curtain-fabric {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(
              180deg,
              rgba(255, 220, 200, 0.18) 0%,
              transparent 18%,
              transparent 55%,
              rgba(0, 0, 0, 0.35) 100%
            ),
            repeating-linear-gradient(
              90deg,
              #3a0610 0px,
              #5c0c18 6px,
              #8b1528 11px,
              #a31b32 14px,
              #6e101e 19px,
              #4a0a14 24px,
              #2e040c 28px
            );
        }
        .fern-curtain-sheen {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            105deg,
            transparent 20%,
            rgba(255, 190, 180, 0.12) 42%,
            transparent 58%,
            rgba(0, 0, 0, 0.2) 78%,
            transparent 92%
          );
          mix-blend-mode: soft-light;
          pointer-events: none;
        }
        .fern-curtain-pile {
          position: absolute;
          inset: 0;
          opacity: 0.35;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
          mix-blend-mode: multiply;
          pointer-events: none;
        }
        .fern-curtain-edge {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 14px;
          background: linear-gradient(
            180deg,
            #d4a574 0%,
            #f0d5a0 18%,
            #b8860b 45%,
            #8b6914 70%,
            #d4a574 100%
          );
          box-shadow: 0 0 12px rgba(212, 165, 116, 0.35);
        }
        .fern-curtain-panel--left .fern-curtain-edge { right: 0; }
        .fern-curtain-panel--right .fern-curtain-edge { left: 0; }
        .fern-curtain-valance {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: min(12vh, 96px);
          z-index: 2;
          background: linear-gradient(180deg, #2a040c 0%, #6b101e 35%, #8b1528 70%, #4a0a14 100%);
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55);
          transition: opacity 1.2s ease 1.2s, transform 1.2s ease 1.2s;
        }
        .fern-curtain-stage[data-open="true"] .fern-curtain-valance {
          opacity: 0;
          transform: translateY(-110%);
        }
        .fern-curtain-fringe {
          position: absolute;
          left: 0;
          right: 0;
          bottom: -10px;
          height: 18px;
          background: repeating-linear-gradient(
            90deg,
            #c9a227 0 5px,
            transparent 5px 9px,
            #8b6914 9px 12px,
            transparent 12px 16px
          );
          opacity: 0.85;
        }
        .fern-curtain-skip {
          position: absolute;
          top: max(1rem, env(safe-area-inset-top));
          right: max(1rem, env(safe-area-inset-right));
          z-index: 3;
          background: rgba(255, 255, 255, 0.92);
          padding: 0.5rem 1rem;
          border-radius: 9999px;
          font-size: 0.875rem;
          color: #374151;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
          border: 1px solid #e5e7eb;
          opacity: 0;
          animation: fern-curtain-skip-in 0.4s ease 0.8s forwards;
        }
        @keyframes fern-curtain-skip-in {
          to { opacity: 1; }
        }
      `}</style>

      <div className="fern-curtain-root" data-opening="curtain_reveal" data-stage={stage}>
        <div
          className="fern-curtain-content"
          data-locked={contentInteractive ? 'false' : 'true'}
        >
          {children}
        </div>

        {showOverlay && (
          <div
            className="fern-curtain-stage"
            data-open={isOpen ? 'true' : 'false'}
            onClick={handleSkip}
            role="button"
            tabIndex={0}
            aria-label="Click to skip animation"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleSkip()
              }
            }}
          >
            <div className="fern-curtain-valance" aria-hidden>
              <div className="fern-curtain-fringe" />
            </div>

            <div className="fern-curtain-panel fern-curtain-panel--left" aria-hidden>
              <div className="fern-curtain-fabric" />
              <div className="fern-curtain-sheen" />
              <div className="fern-curtain-pile" />
              <div className="fern-curtain-edge" />
            </div>

            <div className="fern-curtain-panel fern-curtain-panel--right" aria-hidden>
              <div className="fern-curtain-fabric" />
              <div className="fern-curtain-sheen" />
              <div className="fern-curtain-pile" />
              <div className="fern-curtain-edge" />
            </div>

            <div className="fern-curtain-skip">Click to skip</div>
          </div>
        )}
      </div>
    </>
  )
}
