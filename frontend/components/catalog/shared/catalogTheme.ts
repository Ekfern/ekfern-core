import type { CSSProperties } from 'react'

export interface CatalogTheme {
  bg: string
  fg: string
  primary: string
  muted: string
  fontTitle: string
  fontBody: string
}

export const DEFAULT_CATALOG_THEME: CatalogTheme = {
  bg: '#E8D8C3',
  fg: '#0B3D2E',
  primary: '#0B3D2E',
  muted: '#6B7280',
  fontTitle: 'Georgia, serif',
  fontBody: 'Inter, sans-serif',
}

export function themeFromInvitePublished(publishedTheme?: {
  backgroundColor?: string
  fontColor?: string
  primaryColor?: string
  mutedColor?: string
  titleFont?: string
  bodyFont?: string
}): CatalogTheme {
  if (!publishedTheme) return DEFAULT_CATALOG_THEME
  return {
    bg: publishedTheme.backgroundColor || DEFAULT_CATALOG_THEME.bg,
    fg: publishedTheme.fontColor || DEFAULT_CATALOG_THEME.fg,
    primary: publishedTheme.primaryColor || DEFAULT_CATALOG_THEME.primary,
    muted: publishedTheme.mutedColor || DEFAULT_CATALOG_THEME.muted,
    fontTitle: publishedTheme.titleFont || DEFAULT_CATALOG_THEME.fontTitle,
    fontBody: publishedTheme.bodyFont || DEFAULT_CATALOG_THEME.fontBody,
  }
}

export function catalogThemeStyleVars(theme: CatalogTheme): CSSProperties {
  return {
    '--theme-bg': theme.bg,
    '--theme-fg': theme.fg,
    '--theme-primary': theme.primary,
    '--theme-muted': theme.muted,
    '--theme-font-title': theme.fontTitle,
    '--theme-font-body': theme.fontBody,
    background: theme.bg,
    color: theme.fg,
    fontFamily: theme.fontBody,
  } as React.CSSProperties
}

export interface CatalogInviteSnapshot {
  title?: string
  background_url?: string
  has_rsvp?: boolean
  has_registry?: boolean
  date?: string
  city?: string
  page_config?: { tiles?: Array<{ type: string; enabled?: boolean; settings?: unknown }> }
  published_config?: { theme?: Record<string, string> }
  guest_context?: { name?: string; email?: string } | null
  catalog_show_on_event_page?: boolean
  catalog_show_on_rsvp_confirmation?: boolean
  catalog_title?: string
  catalog_purpose?: string
}
