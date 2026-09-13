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

/** Match curtain velvet so the chunk-load cover does not flash through to black chrome. */
const OPENING_LOAD_COVER: Record<string, string> = {
  curtain_reveal: '#2a040c',
}

interface OpeningLayerProps {
  id: string | null
  slug?: string
  children: React.ReactNode
  /** Cheap cover while the opening chunk loads (no module JS). */
  coverColor?: string
}

export default function OpeningLayer({
  id,
  slug,
  children,
  coverColor = '#E8D8C3',
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
      <div className="relative min-h-full w-full">
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
            style={{ background: loadCover }}
            aria-hidden
          />
        )}
      </div>
    </OpeningCompleteContext.Provider>
  )
}
