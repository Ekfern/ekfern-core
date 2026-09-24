'use client'

/**
 * Loads the selected opening module (if any) and gates invite content until it
 * reports completion. Experience overlays read OpeningCompleteContext so they
 * do not fetch their chunk until the opening is done.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { OpeningModule } from '@/lib/invite/animations/types'
import { openingLoaders, type OpeningModuleId } from './openingLoaders'

const OpeningCompleteContext = createContext(true)

export function useOpeningComplete(): boolean {
  return useContext(OpeningCompleteContext)
}

/** Match each opening's first frame so the chunk-load cover does not flash. */
const OPENING_LOAD_COVER: Record<string, string> = {
  curtain_reveal: '#2a040c',
  water_drop: '#dfe7ec',
}

interface OpeningLayerProps {
  id: string | null
  slug?: string
  children: React.ReactNode
  /** Cheap cover while the opening chunk loads (no module JS). */
  coverColor?: string
  /** Layout class for the load wrapper (phone preview needs a bounded flex column). */
  className?: string
}

export default function OpeningLayer({
  id,
  slug,
  children,
  coverColor = '#E8D8C3',
  className,
}: OpeningLayerProps) {
  const loader =
    id && id in openingLoaders
      ? openingLoaders[id as OpeningModuleId]
      : undefined

  const [Module, setModule] = useState<OpeningModule | null>(null)
  const [complete, setComplete] = useState(!loader)
  const completeRef = useRef(!loader)

  const handleComplete = useCallback(() => {
    if (completeRef.current) return
    completeRef.current = true
    setComplete(true)
  }, [])

  useEffect(() => {
    completeRef.current = !loader
    setComplete(!loader)
    setModule(null)

    if (!loader) return

    let cancelled = false
    loader()
      .then((mod) => {
        if (!cancelled) setModule(() => mod.default)
      })
      .catch(() => {
        // Chunk failed — reveal the invite rather than leave guests stuck.
        if (!cancelled) handleComplete()
      })

    return () => {
      cancelled = true
    }
  }, [loader, handleComplete])

  if (!loader) {
    return (
      <OpeningCompleteContext.Provider value={true}>
        {children}
      </OpeningCompleteContext.Provider>
    )
  }

  const loadCover = (id && OPENING_LOAD_COVER[id]) || coverColor

  // Keep the invite painted under the load cover / curtains. Hiding children
  // (visibility:hidden) caused a black flash when the curtain stage was
  // transparent and the phone chrome showed through for a frame.
  return (
    <OpeningCompleteContext.Provider value={Module ? complete : false}>
      {/*
        borderRadius:'inherit' walks the phone-preview frame's radius down to the
        module. Opening stages are position:fixed, and an ancestor's overflow
        clips those to its rectangle but NOT to its corner radius — without this
        the overlay paints square corners over the rounded bezel.
      */}
      <div className={className ?? 'relative min-h-full w-full'} style={{ borderRadius: 'inherit' }}>
        {Module ? (
          <Module slug={slug} onComplete={handleComplete}>
            {children}
          </Module>
        ) : (
          children
        )}
        {!Module && (
          <div
            className="absolute inset-0 z-[9998]"
            style={{ background: loadCover, borderRadius: 'inherit' }}
            aria-hidden
          />
        )}
      </div>
    </OpeningCompleteContext.Provider>
  )
}
