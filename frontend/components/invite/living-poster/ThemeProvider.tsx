'use client'

import React, { createContext, useContext } from 'react'
import { InviteConfig } from '@/lib/invite/schema'
import { resolveAppearance } from '@/lib/invite/appearance'

export interface ColorsAndFonts {
  backgroundColor: string
  fontColor: string
  primaryColor: string
  mutedColor: string
  titleFont: string
  bodyFont: string
  overlayOpacity: number
}

interface ThemeContextType {
  colors: ColorsAndFonts
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  config?: InviteConfig
  children: React.ReactNode
}

export function ThemeProvider({ config, children }: ThemeProviderProps) {
  // The config carries its own colours and fonts; see lib/invite/appearance.ts
  // for why there is no longer a theme to look them up from.
  const colors: ColorsAndFonts = resolveAppearance(config)

  return (
    <ThemeContext.Provider value={{ colors }}>
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
    </ThemeContext.Provider>
  )
}

export function useTheme(): ColorsAndFonts {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context.colors
}

