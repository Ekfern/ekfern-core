/**
 * Shared contracts for invitation animation modules.
 *
 * Opening modules gate first paint and must call onComplete once on every path.
 * Experience modules are viewport overlays that run while the guest explores.
 * Hosts only select module IDs; timing, density, and assets live inside modules.
 */

import type { ComponentType, ReactNode } from 'react'

export type AnimationSlot = 'opening' | 'experience'

export interface AnimationCatalogEntry {
  id: string
  label: string
  description: string
  slot: AnimationSlot
}

export interface OpeningModuleProps {
  children: ReactNode
  slug?: string
  onComplete: () => void
}

export interface ExperienceModuleProps {
  slug?: string
}

export type OpeningModule = ComponentType<OpeningModuleProps>
export type ExperienceModule = ComponentType<ExperienceModuleProps>

export interface ResolvedAnimations {
  opening: string | null
  experience: string | null
}
