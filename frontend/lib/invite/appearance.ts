import type { InviteConfig } from './schema'

/**
 * How an invite's look is resolved.
 *
 * This replaces the old theme system. A `themeId` used to name a palette that
 * only existed in code, which meant an invite's appearance was decided by a
 * concept no host could see, set implicitly when a page or template was
 * created. Configs now carry their own look, so what you read in the config is
 * what renders.
 *
 * An invitation's look is eight families. Six already live at page level:
 * palette (`customColors`), type (`customFonts`), rhythm (`spacing`), surface
 * (`texture`), ornament (`pageBorder`/`pageFrame`/`cornerDecorations`) and
 * motion (`animations`). Shape and depth did not, so every tile answered those
 * two questions for itself - corner radius under four different names, shadow
 * under three, none of them agreeing. That is why a page could show three
 * different margins and four different corners, and why a tile added on day
 * forty looked bolted onto a design chosen on day one.
 *
 * This module resolves all of it into one set of values, which
 * `AppearanceProvider` publishes as CSS custom properties. The rule the tiles
 * follow from there: a tile decides what it *is*, never what it *looks like*.
 */

export type InviteShape = 'sharp' | 'soft' | 'rounded'
export type InviteDepth = 'flat' | 'raised' | 'lifted'
export type InviteSpacing = 'tight' | 'normal' | 'spacious'

/**
 * Shape: how edges behave. Surfaces (cards, images, the map) and controls
 * (buttons) move together but are not the same value - a design can want soft
 * cards with pill buttons, or sharp cards with barely-rounded ones.
 */
const SHAPE_SCALE: Record<InviteShape, { surface: string; control: string }> = {
  sharp: { surface: '0px', control: '4px' },
  soft: { surface: '12px', control: '9999px' },
  rounded: { surface: '20px', control: '9999px' },
}

/**
 * Depth: whether things rest on the paper or lift off it. `rest` is what a
 * surface gets by default; `lift` is for the few things meant to sit above the
 * page, like a polaroid.
 */
const DEPTH_SCALE: Record<InviteDepth, { rest: string; lift: string }> = {
  flat: { rest: 'none', lift: 'none' },
  raised: { rest: '0 1px 2px rgba(0,0,0,.08)', lift: '0 4px 10px -2px rgba(0,0,0,.15)' },
  lifted: { rest: '0 4px 10px -2px rgba(0,0,0,.15)', lift: '0 12px 24px -8px rgba(0,0,0,.22)' },
}

/**
 * Rhythm: three relationships rather than one gap, because spacing carries
 * meaning. Things that belong together sit at `cluster`; a normal move between
 * blocks is `section`; `chapter` is a breath between movements.
 *
 * `section` deliberately equals the flat gap the page already used for each
 * density (16 / 32 / 48px), so adopting these values changes nothing that is
 * on a page today. `cluster` and `chapter` are new capability, not a rewrite.
 */
const RHYTHM_SCALE: Record<
  InviteSpacing,
  { cluster: string; section: string; chapter: string; inset: string }
> = {
  tight: { cluster: '0.5rem', section: '1rem', chapter: '2.5rem', inset: '1rem' },
  normal: { cluster: '0.75rem', section: '2rem', chapter: '4rem', inset: '1.25rem' },
  spacious: { cluster: '1rem', section: '3rem', chapter: '6rem', inset: '1.5rem' },
}

/**
 * Last-resort values for a config that says nothing - a brand new page, or a
 * preview of a layout that has not defined its own look.
 *
 * The colours and fonts are what the old default theme resolved to, so nothing
 * that previously fell through changes. Shape and depth are set to the values
 * already most common in the tiles: 12px surfaces (poster, directions and the
 * carousel all use it today), pill controls (the timer and the details buttons
 * already do), and the subtle shadow that both the gallery and the carousel
 * default to. Adopting them moves the outliers to meet the majority rather
 * than imposing a new opinion.
 */
export const INVITE_APPEARANCE_DEFAULTS = {
  backgroundColor: '#E8D8C3',
  fontColor: '#0B3D2E',
  primaryColor: '#D4A017',
  mutedColor: '#8B5E3C',
  titleFont: "'Cormorant Garamond', serif",
  bodyFont: "Georgia, 'Times New Roman', serif",
  overlayOpacity: 0.18,
  shape: 'soft' as InviteShape,
  depth: 'raised' as InviteDepth,
  spacing: 'normal' as InviteSpacing,
  /** Roughly 65 characters, the point past which running text gets hard to track. */
  measure: '36rem',
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
  /** Corner radius for cards, images and other surfaces. */
  radiusSurface: string
  /** Corner radius for buttons and other controls. */
  radiusControl: string
  /** Shadow for something resting on the page. */
  shadowRest: string
  /** Shadow for something deliberately lifted above it. */
  shadowLift: string
  /** Gap between elements that belong together. */
  spaceCluster: string
  /** Gap for a normal move from one block to the next. */
  spaceSection: string
  /** Gap for a breath between movements. */
  spaceChapter: string
  /** The margin down both sides of the page. */
  insetPage: string
  /** Maximum width for running text. */
  measureText: string
}

/** Resolve the look an invite should render with. */
export function resolveAppearance(config?: Partial<InviteConfig> | null): InviteAppearance {
  const colors = config?.customColors ?? {}
  const fonts = config?.customFonts ?? {}

  const shape = SHAPE_SCALE[config?.shape ?? INVITE_APPEARANCE_DEFAULTS.shape]
    ?? SHAPE_SCALE[INVITE_APPEARANCE_DEFAULTS.shape]
  const depth = DEPTH_SCALE[config?.depth ?? INVITE_APPEARANCE_DEFAULTS.depth]
    ?? DEPTH_SCALE[INVITE_APPEARANCE_DEFAULTS.depth]
  const rhythm = RHYTHM_SCALE[config?.spacing ?? INVITE_APPEARANCE_DEFAULTS.spacing]
    ?? RHYTHM_SCALE[INVITE_APPEARANCE_DEFAULTS.spacing]

  return {
    backgroundColor: colors.backgroundColor ?? INVITE_APPEARANCE_DEFAULTS.backgroundColor,
    backgroundGradient: colors.backgroundGradient,
    fontColor: colors.fontColor ?? INVITE_APPEARANCE_DEFAULTS.fontColor,
    primaryColor: colors.primaryColor ?? INVITE_APPEARANCE_DEFAULTS.primaryColor,
    mutedColor: colors.mutedColor ?? INVITE_APPEARANCE_DEFAULTS.mutedColor,
    titleFont: fonts?.titleFont ?? INVITE_APPEARANCE_DEFAULTS.titleFont,
    bodyFont: fonts?.bodyFont ?? INVITE_APPEARANCE_DEFAULTS.bodyFont,
    overlayOpacity: INVITE_APPEARANCE_DEFAULTS.overlayOpacity,
    radiusSurface: shape.surface,
    radiusControl: shape.control,
    shadowRest: depth.rest,
    shadowLift: depth.lift,
    spaceCluster: rhythm.cluster,
    spaceSection: rhythm.section,
    spaceChapter: rhythm.chapter,
    insetPage: rhythm.inset,
    measureText: INVITE_APPEARANCE_DEFAULTS.measure,
  }
}
