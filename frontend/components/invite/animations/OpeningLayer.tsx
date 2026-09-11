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

  if (!Module) {
    return (
      <OpeningCompleteContext.Provider value={false}>
        <div
          className="fixed inset-0 z-[9998]"
          style={{ background: coverColor }}
          aria-hidden
        />
        {/* Keep children mounted (hidden) so hydration stays stable once the module arrives. */}
        <div className="invisible pointer-events-none" aria-hidden>
          {children}
        </div>
      </OpeningCompleteContext.Provider>
    )
  }

  return (
    <OpeningCompleteContext.Provider value={complete}>
      <Module slug={slug} onComplete={handleComplete}>
        {children}
      </Module>
    </OpeningCompleteContext.Provider>
  )
}
