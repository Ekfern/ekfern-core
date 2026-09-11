'use client'

/**
 * Loads the selected invite-experience module only after the opening reports
 * completion (or immediately when there is no opening). Unknown / null ids
 * render nothing and fetch no chunk.
 */

import React, { useEffect, useState } from 'react'
import type { ExperienceModule } from '@/lib/invite/animations/types'
import { experienceLoaders, type ExperienceModuleId } from './experienceLoaders'
import { useOpeningComplete } from './OpeningLayer'

interface ExperienceLayerProps {
  id: string | null
  slug?: string
}

export default function ExperienceLayer({ id, slug }: ExperienceLayerProps) {
  const openingComplete = useOpeningComplete()
  const loader =
    id && openingComplete && id in experienceLoaders
      ? experienceLoaders[id as ExperienceModuleId]
      : undefined

  const [Module, setModule] = useState<ExperienceModule | null>(null)

  useEffect(() => {
    setModule(null)
    if (!loader) return

    let cancelled = false
    loader()
      .then((mod) => {
        if (!cancelled) setModule(() => mod.default)
      })
      .catch(() => {
        // Experience is decorative — failure is silent.
      })

    return () => {
      cancelled = true
    }
  }, [loader])

  if (!Module) return null
  return <Module slug={slug} />
}
