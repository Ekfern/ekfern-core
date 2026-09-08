'use client'

import React from 'react'
import { BRAND_NAME, COMPANY_HOMEPAGE } from '@/lib/brand_utility'
import type { InviteConfig } from '@/lib/invite/schema'
import { resolveAppearance } from '@/lib/invite/appearance'
import {
  CONTRAST_FLOOR,
  contrastSurfaces,
  ensureContrast,
  mixHex,
  worstContrast,
} from '@/lib/invite/paletteUtils'

export interface PoweredByBrandingProps {
  /** The invitation this credit is sitting on. Absent means the safe defaults. */
  config?: Partial<InviteConfig> | null
}

/**
 * The credit at the foot of an invitation.
 *
 * It used to state its own greys - gray-400 on the sentence, gray-500 on the
 * link - on a page whose background the host picks. Against this invitation's
 * gradient that measured 1.12:1 where the floor for body text is 4.5, so the
 * one line on the page with a job to do was the one nobody could read, and the
 * link was quieter than the sentence around it.
 *
 * Both colours now come from the invitation's own ink and are proved against
 * every surface the page can put behind them. The sentence is allowed to be
 * quiet; the link is not, because it is the thing being offered.
 */
export default function PoweredByBranding({ config }: PoweredByBrandingProps) {
  const appearance = resolveAppearance(config)
  const surfaces = contrastSurfaces({
    backgroundColor: appearance.backgroundColor,
    backgroundGradient: appearance.backgroundGradient,
    material: appearance.material,
  })

  // As quiet as the page allows, then pushed back until it provably clears the
  // floor. Choosing the softness by eye is exactly how 1.12:1 happened.
  const quiet = ensureContrast(
    mixHex(appearance.fontColor, surfaces[0] ?? appearance.backgroundColor, 0.45),
    surfaces,
    CONTRAST_FLOOR.body,
  )
  // The link must be at least as legible as the sentence it sits in, not merely
  // above the floor: pushed independently, a quietened ink can overshoot and
  // end up clearer than the link, which is the wrong way round for the one
  // element being offered.
  const link = ensureContrast(
    appearance.fontColor,
    surfaces,
    Math.max(CONTRAST_FLOOR.body, worstContrast(quiet, surfaces)),
  )
  const rule = mixHex(appearance.fontColor, surfaces[0] ?? appearance.backgroundColor, 0.7)

  return (
    <div className="w-full py-8 px-4 flex flex-col items-center gap-2">
      <div className="w-12 h-px" style={{ backgroundColor: rule }} />
      <p className="text-xs text-center leading-relaxed" style={{ color: quiet }}>
        Create your own free invite on{' '}
        <a
          href={`${COMPANY_HOMEPAGE}?utm_source=invite_footer&utm_medium=referral&utm_campaign=powered_by`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline underline-offset-2"
          style={{ color: link }}
        >
          {BRAND_NAME}
        </a>
      </p>
    </div>
  )
}
