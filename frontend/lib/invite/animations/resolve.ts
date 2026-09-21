/**
 * Resolve host animation selections from InviteConfig.
 *
 * Returns arrays per slot (future multi-support). Legacy scalar strings and
 * `animations.envelope` boolean are normalized. Unknown loader ids are dropped.
 * Layers still consume primaryAnimationId() until multi-stacking ships.
 */

import type { InviteConfig } from '../schema'
import { isKnownExperienceId, isKnownOpeningId } from './catalog'
import type { ResolvedAnimations } from './types'
import { MAX_ANIMATIONS_PER_SLOT } from './types'

export function resolveAnimations(
  animations: InviteConfig['animations'] | null | undefined,
): ResolvedAnimations {
  return {
    opening: resolveOpening(animations),
    experience: resolveExperience(animations),
  }
}

function resolveOpening(
  animations: InviteConfig['animations'] | null | undefined,
): string[] {
  if (!animations) {
    return ['envelope_reveal']
  }

  if ('opening' in animations) {
    return normalizeIdList(animations.opening, isKnownOpeningId)
  }

  if (animations.envelope === false) return []
  return ['envelope_reveal']
}

function resolveExperience(
  animations: InviteConfig['animations'] | null | undefined,
): string[] {
  if (!animations || !('experience' in animations)) return []
  return normalizeIdList(animations.experience, isKnownExperienceId)
}

/**
 * Accept array, legacy scalar string, null/empty → filtered known ids.
 * Does not enforce MAX_ANIMATIONS_PER_SLOT (editors do); runtime uses [0].
 */
function normalizeIdList(
  raw: string | string[] | null | undefined,
  isKnown: (id: string | null | undefined) => boolean,
): string[] {
  if (raw === null || raw === undefined || raw === '') return []

  const list = Array.isArray(raw) ? raw : [raw]
  const known = list.filter((id): id is string => typeof id === 'string' && isKnown(id))
  return known
}

/** Clamp a slot array for save (max one until multi is enabled). */
export function clampAnimationSlot(
  ids: string[] | null | undefined,
  max: number = MAX_ANIMATIONS_PER_SLOT,
): string[] {
  if (!ids || ids.length === 0) return []
  return ids.slice(0, Math.max(0, max))
}
