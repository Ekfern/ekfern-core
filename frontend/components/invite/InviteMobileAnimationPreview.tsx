'use client'

/**
 * Host mobile-preview animation shell.
 *
 * Modules use position:fixed; transform on this root makes overlays resolve
 * against the phone screen instead of the full browser viewport.
 */

import React, { useCallback, useState } from 'react'
import OpeningLayer from '@/components/invite/animations/OpeningLayer'
import ExperienceLayer from '@/components/invite/animations/ExperienceLayer'
import { primaryAnimationId } from '@/lib/invite/animations/types'
import { resolveAnimations } from '@/lib/invite/animations/resolve'
import type { InviteConfig } from '@/lib/invite/schema'

export function useInvitePreviewAnimationState(
  config: InviteConfig,
  previewSlugBase: string,
) {
  const resolved = resolveAnimations(config.animations)
  const openingId = primaryAnimationId(resolved.opening)
  const experienceId = primaryAnimationId(resolved.experience)
  const [replayKey, setReplayKey] = useState(0)

  const replayOpening = useCallback(() => {
    setReplayKey((k) => k + 1)
  }, [])

  return {
    openingId,
    experienceId,
    replayKey,
    slug: `${previewSlugBase}-${openingId ?? 'none'}-r${replayKey}`,
    layerKey: `opening:${openingId ?? 'none'}:${replayKey}`,
    replayOpening,
  }
}

interface InviteMobileAnimationShellProps {
  openingId: string | null
  experienceId: string | null
  slug: string
  layerKey: string
  coverColor?: string
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

/** Phone-screen wrapper: OpeningLayer + ExperienceLayer, contained overlays. */
export function InviteMobileAnimationShell({
  openingId,
  experienceId,
  slug,
  layerKey,
  coverColor = '#E8D8C3',
  children,
  className,
  style,
}: InviteMobileAnimationShellProps) {
  return (
    <div
      className={className}
      style={{
        ...style,
        transform: 'translateZ(0)',
      }}
    >
      <OpeningLayer
        key={layerKey}
        id={openingId}
        slug={slug}
        coverColor={coverColor}
      >
        {children}
        <ExperienceLayer id={experienceId} slug={slug} />
      </OpeningLayer>
    </div>
  )
}

interface PlayOpeningButtonProps {
  visible: boolean
  onPlay: () => void
  /** inline = next to the Opening select; abovePreview = convenience control over the phone */
  variant?: 'inline' | 'abovePreview'
  className?: string
}

/** Play / replay the selected opening in the mobile preview. */
export function PlayOpeningButton({
  visible,
  onPlay,
  variant = 'inline',
  className = '',
}: PlayOpeningButtonProps) {
  if (!visible) return null

  if (variant === 'abovePreview') {
    return (
      <div className={`flex justify-center w-full mb-3 ${className}`.trim()}>
        <button
          type="button"
          onClick={onPlay}
          className="inline-flex items-center gap-1.5 rounded-lg border border-eco-green bg-white px-3 py-1.5 text-sm font-medium text-eco-green hover:bg-eco-beige transition-colors"
        >
          <PlayIcon className="w-3.5 h-3.5" />
          Play opening
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label="Play opening animation in mobile preview"
      title="Play opening in mobile preview"
      className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-eco-green bg-white px-3 text-sm font-medium text-eco-green hover:bg-eco-beige transition-colors ${className}`.trim()}
    >
      <PlayIcon className="w-3.5 h-3.5" />
      Play
    </button>
  )
}

/** @deprecated Use PlayOpeningButton */
export function ReplayOpeningButton({
  visible,
  onReplay,
}: {
  visible: boolean
  onReplay: () => void
}) {
  return (
    <PlayOpeningButton
      visible={visible}
      onPlay={onReplay}
      variant="abovePreview"
    />
  )
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.34-5.89a1.5 1.5 0 000-2.54L6.3 2.84z" />
    </svg>
  )
}
