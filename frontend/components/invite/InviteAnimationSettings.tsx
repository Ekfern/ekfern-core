'use client'

import React, { useState } from 'react'
import type { InviteConfig } from '@/lib/invite/schema'
import { resolveAnimations, clampAnimationSlot } from '@/lib/invite/animations/resolve'
import { primaryAnimationId } from '@/lib/invite/animations/types'
import { useAnimationRegistryPicker } from '@/lib/invite/animations/useAnimationRegistryPicker'
import { PlayOpeningButton } from '@/components/invite/InviteMobileAnimationPreview'

/**
 * The opening animation and the ambient effect, shared by the host's page
 * editor and the staff page layout studio.
 *
 * Both had their own copy. They had drifted only cosmetically — different
 * input ids, different helper text, and the studio's selects had lost the
 * accent colour — but two copies of a picker over the same registry is one
 * copy too many.
 *
 * What genuinely differs between the surfaces is passed in: the wording, the
 * id prefix, and what the Play button does, since each one scrolls to its own
 * preview.
 */

interface InviteAnimationSettingsProps {
  config: InviteConfig
  setConfig: React.Dispatch<React.SetStateAction<InviteConfig>>
  /** Keeps ids unique and labels bound to the right control on each surface. */
  idPrefix?: string
  /** Surface-specific explanation under the heading. */
  description?: string
  /** Scroll to and play the opening in that surface's preview. */
  onPlay?: () => void
  /** Whether the Play button has an opening to play. */
  canPlay?: boolean
  defaultOpen?: boolean
}

export default function InviteAnimationSettings({
  config,
  setConfig,
  idPrefix = 'opening',
  description = 'How the invite opens and what drifts while guests read. Use Play to watch the opening in the Mobile Preview.',
  onPlay,
  canPlay = false,
  defaultOpen = false,
}: InviteAnimationSettingsProps) {
  const [open, setOpen] = useState(defaultOpen)
  const { openingOptions, experienceOptions } = useAnimationRegistryPicker()

  return (
    <div className="border-t border-gray-200 pt-4 mt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left focus:outline-none focus:ring-2 focus:ring-eco-green rounded-md"
      >
        <span className="text-sm font-medium">Invite Animations</span>
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          <p className="text-xs text-gray-500">{description}</p>
          <div className="space-y-1">
            <label className="block text-sm font-medium" htmlFor={`${idPrefix}-opening-animation`}>
              Opening
            </label>
            <p className="text-xs text-gray-500">Plays when guests first open the invite</p>
            <div className="mt-1 flex gap-2 items-stretch">
              <select
                id={`${idPrefix}-opening-animation`}
                value={primaryAnimationId(resolveAnimations(config.animations).opening) ?? ''}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  animations: {
                    ...prev.animations,
                    opening: clampAnimationSlot(
                      e.target.value ? [e.target.value] : [],
                    ),
                  },
                }))}
                className="min-w-0 flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm accent-eco-green focus:ring-eco-green focus:border-eco-green"
              >
                <option value="">None</option>
                {openingOptions.map((entry) => (
                  <option key={entry.moduleId} value={entry.moduleId}>
                    {entry.label}
                  </option>
                ))}
              </select>
              {onPlay && (
                <PlayOpeningButton
                  visible={canPlay}
                  onPlay={onPlay}
                  variant="inline"
                />
              )}
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium" htmlFor={`${idPrefix}-experience-animation`}>
              While reading
            </label>
            <p className="text-xs text-gray-500">Soft ambient effect while guests explore</p>
            <select
              id={`${idPrefix}-experience-animation`}
              value={primaryAnimationId(resolveAnimations(config.animations).experience) ?? ''}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                animations: {
                  ...prev.animations,
                  experience: clampAnimationSlot(
                    e.target.value ? [e.target.value] : [],
                  ),
                },
              }))}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm accent-eco-green focus:ring-eco-green focus:border-eco-green"
            >
              <option value="">None</option>
              {experienceOptions.map((entry) => (
                <option key={entry.moduleId} value={entry.moduleId}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
