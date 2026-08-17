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
 * tile, and it currently carries colour and type only - no radius, spacing or
 * shadow, which is why those are duplicated across tile settings instead.
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
      } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
