/**
 * Host-facing animation catalogs — labels only, no React / module imports.
 * Guest pages resolve IDs via lazy loader maps; the editor prefers the
 * Postgres animation registry API and falls back to these lists.
 */

import type { AnimationCatalogEntry } from './types'

export const OPENING_ANIMATIONS: AnimationCatalogEntry[] = [
  {
    id: 'envelope_reveal',
    label: 'Envelope Reveal',
    description: 'Envelope opens when guests first view the invite',
    slot: 'opening',
  },
  {
    id: 'curtain_reveal',
    label: 'Curtain Reveal',
    description: 'Velvet curtains part from the center to reveal the invite',
    slot: 'opening',
  },
]

export const EXPERIENCE_ANIMATIONS: AnimationCatalogEntry[] = [
  {
    id: 'rose_petals',
    label: 'Rose Petals',
    description: 'Soft petals drift while guests read the invite',
    slot: 'experience',
  },
]

const OPENING_IDS = new Set(OPENING_ANIMATIONS.map((e) => e.id))
const EXPERIENCE_IDS = new Set(EXPERIENCE_ANIMATIONS.map((e) => e.id))

export function isKnownOpeningId(id: string | null | undefined): boolean {
  return !!id && OPENING_IDS.has(id)
}

export function isKnownExperienceId(id: string | null | undefined): boolean {
  return !!id && EXPERIENCE_IDS.has(id)
}
