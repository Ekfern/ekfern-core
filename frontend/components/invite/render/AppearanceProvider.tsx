'use client'

import React from 'react'
import { InviteConfig } from '@/lib/invite/schema'
import { resolveAppearance } from '@/lib/invite/appearance'

/**
 * Publishes an invite's appearance to its tiles as CSS custom properties.
 *
 * The name is historical. There is no theme: a `themeId` used to name a palette
 * that lived only in code, and it was retired - see lib/invite/appearance.ts.
 * What this does now is resolve the colours and fonts the config carries and
 * hand them down the tree, so a tile can ask for `var(--theme-fg)` instead of
 * being passed a colour by every renderer above it.
 *
 * This is the only channel by which a page-level design decision reaches a
 * tile. It carries all eight look families; see lib/invite/appearance.ts for
 * what each one means and why shape and depth were the two that used to be
 * missing.
 *
 * It also used to expose the same values through React context, via a
 * `useTheme()` hook. That had exactly one caller, which used it to re-apply
 * overrides `resolveAppearance` had already applied, so both are gone.
 */
interface AppearanceProviderProps {
  config?: InviteConfig
  children: React.ReactNode
}

export function AppearanceProvider({ config, children }: AppearanceProviderProps) {
  const colors = resolveAppearance(config)

  return (
    <div
      style={{
        '--theme-bg': colors.backgroundColor,
        '--theme-fg': colors.fontColor,
        '--theme-primary': colors.primaryColor,
        '--theme-muted': colors.mutedColor,
        '--theme-overlay-opacity': colors.overlayOpacity,
        '--theme-font-title': colors.titleFont,
        '--theme-font-body': colors.bodyFont,

        // Shape: cards/images/media vs buttons.
        '--radius-surface': colors.radiusSurface,
        '--radius-control': colors.radiusControl,

        // Depth: resting on the page vs lifted above it.
        '--shadow-rest': colors.shadowRest,
        '--shadow-lift': colors.shadowLift,

        // Rhythm: three relationships, not one gap. `section` matches the flat
        // gap the page used before, so adopting these changes nothing today.
        '--space-cluster': colors.spaceCluster,
        '--space-section': colors.spaceSection,
        '--space-chapter': colors.spaceChapter,
        '--inset-page': colors.insetPage,
        '--measure-text': colors.measureText,
      } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
