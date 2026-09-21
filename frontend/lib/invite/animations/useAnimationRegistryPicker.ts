'use client'

/**
 * Load animation registry for host pickers (above the module runtime).
 * Falls back to static catalog labels if the API is unavailable.
 */

import { useEffect, useState } from 'react'
import {
  EXPERIENCE_ANIMATIONS,
  OPENING_ANIMATIONS,
} from '@/lib/invite/animations/catalog'
import {
  getAnimationRegistry,
  type AnimationRegistryEntry,
} from '@/lib/invite/api'

export type AnimationPickerOption = {
  moduleId: string
  label: string
  description?: string
  category?: string
  price?: string | number
}

function toOptions(entries: AnimationRegistryEntry[]): AnimationPickerOption[] {
  return entries.map((e) => ({
    moduleId: e.module_id,
    label: e.name,
    description: e.description,
    category: e.category,
    price: e.price,
  }))
}

function catalogFallback(slot: 'opening' | 'experience'): AnimationPickerOption[] {
  const list = slot === 'opening' ? OPENING_ANIMATIONS : EXPERIENCE_ANIMATIONS
  return list.map((e) => ({
    moduleId: e.id,
    label: e.label,
    description: e.description,
  }))
}

/** Keep newly shipped catalog modules visible even if the registry API is stale. */
function mergeWithCatalog(
  api: AnimationPickerOption[],
  catalog: AnimationPickerOption[],
): AnimationPickerOption[] {
  const seen = new Set(api.map((o) => o.moduleId))
  const missing = catalog.filter((o) => !seen.has(o.moduleId))
  return missing.length === 0 ? api : [...api, ...missing]
}

export function useAnimationRegistryPicker(): {
  openingOptions: AnimationPickerOption[]
  experienceOptions: AnimationPickerOption[]
  loading: boolean
} {
  const [openingOptions, setOpeningOptions] = useState<AnimationPickerOption[]>(
    () => catalogFallback('opening'),
  )
  const [experienceOptions, setExperienceOptions] = useState<AnimationPickerOption[]>(
    () => catalogFallback('experience'),
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await getAnimationRegistry({ status: 'published' })
        if (cancelled) return
        const opening = toOptions(rows.filter((r) => r.slot === 'opening'))
        const experience = toOptions(rows.filter((r) => r.slot === 'experience'))
        if (opening.length > 0) {
          setOpeningOptions(mergeWithCatalog(opening, catalogFallback('opening')))
        }
        if (experience.length > 0) {
          setExperienceOptions(mergeWithCatalog(experience, catalogFallback('experience')))
        }
      } catch {
        // Keep catalog fallback
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { openingOptions, experienceOptions, loading }
}
