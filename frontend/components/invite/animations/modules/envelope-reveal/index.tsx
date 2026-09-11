'use client'

/**
 * Opening module: Envelope Reveal.
 * Thin adapter over EnvelopeAnimation so the guest page never imports it by name.
 */

import EnvelopeAnimation from '@/components/invite/EnvelopeAnimation'
import type { OpeningModuleProps } from '@/lib/invite/animations/types'

export default function EnvelopeRevealModule({
  children,
  slug,
  onComplete,
}: OpeningModuleProps) {
  return (
    <EnvelopeAnimation
      enabled
      showAnimation
      slug={slug}
      onAnimationComplete={onComplete}
    >
      {children}
    </EnvelopeAnimation>
  )
}
