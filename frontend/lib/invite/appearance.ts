import type { InviteConfig } from './schema'

/**
 * How an invite's colours and fonts are resolved.
 *
 * This replaces the old theme system. A `themeId` used to name a palette that
 * only existed in code, which meant an invite's appearance was decided by a
 * concept no host could see, set implicitly when a page or template was
 * created. Configs now carry their own colours and fonts, so what you read in
 * the config is what renders.
 *
 * The values below are a last-resort fallback for a config that says nothing -
 * a brand new page, or a preview of a layout that has not defined its own look.
 * They are the values the old default theme resolved to, so nothing that
 * previously fell through changes appearance.
 */
export const INVITE_APPEARANCE_DEFAULTS = {
  backgroundColor: '#E8D8C3',
  fontColor: '#0B3D2E',
  primaryColor: '#D4A017',
  mutedColor: '#8B5E3C',
  titleFont: "'Cormorant Garamond', serif",
  bodyFont: "Georgia, 'Times New Roman', serif",
  overlayOpacity: 0.18,
} as const

export interface InviteAppearance {
  backgroundColor: string
  backgroundGradient?: string
  fontColor: string
  primaryColor: string
  mutedColor: string
  titleFont: string
  bodyFont: string
  overlayOpacity: number
}

/** Resolve the colours and fonts an invite should render with. */
export function resolveAppearance(config?: Partial<InviteConfig> | null): InviteAppearance {
  const colors = config?.customColors ?? {}
  const fonts = config?.customFonts ?? {}

  return {
    backgroundColor: colors.backgroundColor ?? INVITE_APPEARANCE_DEFAULTS.backgroundColor,
    backgroundGradient: colors.backgroundGradient,
    fontColor: colors.fontColor ?? INVITE_APPEARANCE_DEFAULTS.fontColor,
    primaryColor: colors.primaryColor ?? INVITE_APPEARANCE_DEFAULTS.primaryColor,
    mutedColor: colors.mutedColor ?? INVITE_APPEARANCE_DEFAULTS.mutedColor,
    titleFont: fonts?.titleFont ?? INVITE_APPEARANCE_DEFAULTS.titleFont,
    bodyFont: fonts?.bodyFont ?? INVITE_APPEARANCE_DEFAULTS.bodyFont,
    overlayOpacity: INVITE_APPEARANCE_DEFAULTS.overlayOpacity,
  }
}
