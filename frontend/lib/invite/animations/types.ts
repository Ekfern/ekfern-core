/**
 * Shared contracts for invitation animation modules.
 *
 * Opening modules gate first paint and must call onComplete once on every path.
 * Experience modules are viewport overlays that run while the guest explores.
 * Hosts only select module IDs; timing, density, and assets live inside modules.
 *
 * Invite config stores arrays per slot (for future multi); product cap is 1 until
 * stacking is tested — use primaryAnimationId() when wiring layers.
 */

import type { ComponentType, ReactNode } from 'react'

export type AnimationSlot = 'opening' | 'experience'

/** Product cap until multi-animation interference is validated. */
export const MAX_ANIMATIONS_PER_SLOT = 1

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
  /** Known opening module ids, in order (may be empty). */
  opening: string[]
  /** Known experience module ids, in order (may be empty). */
  experience: string[]
}

/** First id for the current single-module layers, or null. */
export function primaryAnimationId(ids: string[] | null | undefined): string | null {
  return ids && ids.length > 0 ? ids[0] : null
}
