/**
 * Resolve host animation selections from InviteConfig.
 *
 * Legacy `animations.envelope` boolean is read only when `opening` is unset,
 * so published invites keep Envelope Reveal by default.
 */

import type { InviteConfig } from '../schema'
import { isKnownExperienceId, isKnownOpeningId } from './catalog'
import type { ResolvedAnimations } from './types'

export function resolveAnimations(
  animations: InviteConfig['animations'] | null | undefined,
): ResolvedAnimations {
  const opening = resolveOpening(animations)
  const experience = resolveExperience(animations)
  return { opening, experience }
}

function resolveOpening(
  animations: InviteConfig['animations'] | null | undefined,
): string | null {
  if (!animations) {
    // No animations blob — match historical default (envelope on).
    return 'envelope_reveal'
  }

  // Prefer explicit opening (including null = host chose none).
  if ('opening' in animations) {
    const raw = animations.opening
    if (raw === null || raw === undefined || raw === '') return null
    return isKnownOpeningId(raw) ? raw : null
  }

  // Legacy boolean
  if (animations.envelope === false) return null
  return 'envelope_reveal'
}

function resolveExperience(
  animations: InviteConfig['animations'] | null | undefined,
): string | null {
  if (!animations || !('experience' in animations)) return null
  const raw = animations.experience
  if (raw === null || raw === undefined || raw === '') return null
  return isKnownExperienceId(raw) ? raw : null
}
