import type { FontRole, InviteConfig } from './schema'
import type { ButtonVariant } from './buttonStyles'
import { isDisplayFamily } from './fonts'

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
 * under three, none of them agreeing. That is why a tile added on day forty
 * looks bolted onto a design chosen on day one: it arrives with the factory's
 * corners and shadow rather than the invitation's.
 *
 * This module resolves all of it into one set of values, which
 * `AppearanceProvider` publishes as CSS custom properties. The rule the tiles
 * follow from there: a tile decides what it *is*, never what it *looks like*.
 */

export type InviteShape = 'sharp' | 'soft' | 'rounded'
export type InviteDepth = 'flat' | 'uniform' | 'featured'
/** The vocabulary before `uniform`/`featured`. Both resolve to `uniform`. */
export type LegacyInviteDepth = 'raised' | 'lifted'
export type InviteMaterial = 'solid' | 'glass'
export type InviteTextAlign = 'left' | 'center' | 'right'
export type InviteSpacing = 'tight' | 'normal' | 'spacious'

/**
 * Shape: how edges behave. Surfaces (cards, images, the map) and controls
 * (buttons) move together but are not the same value - a design can want soft
 * cards with pill buttons, or sharp cards with barely-rounded ones.
 */
const SHAPE_SCALE: Record<InviteShape, { surface: string; control: string }> = {
  sharp: { surface: '0px', control: '0px' },
  soft: { surface: '12px', control: '8px' },
  rounded: { surface: '20px', control: '9999px' },
}

/**
 * Depth: whether things rest on the paper or lift off it. `rest` is what a
 * surface gets by default; `lift` is for the few things meant to sit above the
 * page, like a polaroid.
 */
const DEPTH_SCALE: Record<InviteDepth, { rest: string; lift: string }> = {
  flat: { rest: 'none', lift: 'none' },
  uniform: { rest: '0 1px 2px rgba(0,0,0,.08)', lift: '0 4px 10px -2px rgba(0,0,0,.15)' },
  // Under `featured` the page lies flat and one surface carries the whole
  // difference, so `rest` is nothing and `lift` is stronger than uniform's.
  featured: { rest: 'none', lift: '0 12px 24px -8px rgba(0,0,0,.22)' },
}

/**
 * `raised` and `lifted` both land on `uniform`.
 *
 * `lifted` was the louder of the two, so a page that used it gets slightly
 * softer shadows than before. That is the intended trade: one uniform height
 * is worth more than two intensities of the same idea.
 */
function resolveDepth(depth?: InviteDepth | LegacyInviteDepth | null): InviteDepth {
  if (depth === 'raised' || depth === 'lifted') return 'uniform'
  if (depth === 'flat' || depth === 'uniform' || depth === 'featured') return depth
  return INVITE_APPEARANCE_DEFAULTS.depth
}

/**
 * What a surface is made of, kept apart from how high it sits.
 *
 * Glass used to carry its own shadow - a different one in each of the two tiles
 * that offered it - which is why turning the page flat left two cards floating.
 * It contributes fill, border and blur only.
 */
const MATERIAL_SCALE: Record<InviteMaterial, {
  fill: string
  border: string
  blur: string
  inset: string
}> = {
  solid: { fill: 'transparent', border: '1px solid transparent', blur: 'none', inset: 'none' },
  glass: {
    fill: 'rgba(255,255,255,0.14)',
    border: '1px solid rgba(255,255,255,0.28)',
    blur: 'blur(20px)',
    inset: 'inset 0 1px 0 rgba(255,255,255,0.25)',
  },
}

/** Steps on the type scale, so a role names a step rather than a length. */
const TYPE_SCALE: Record<NonNullable<FontRole['size']>, string> = {
  xs: '0.75rem',
  sm: '0.8125rem',
  md: '1rem',
  lg: 'clamp(1.75rem, 5vw, 2.25rem)',
  xl: 'clamp(2.5rem, 9vw, 4rem)',
}

/**
 * The six recipes, and which of the three host-picked families each draws on.
 *
 * Three roles are chosen; six are rendered. Eyebrow, caption and data have no
 * picker of their own because a fourth family is another webfont on a phone on
 * patchy data, and because nobody deliberately sets captions in a fourth face.
 * What they needed was a recipe, which is what they get here.
 */
const RECIPE_DEFAULTS = {
  title: { role: 'title', weight: 400, size: 'xl', tracking: '0.01em', transform: 'none' },
  header: { role: 'header', weight: 500, size: 'lg', tracking: '0.02em', transform: 'none' },
  body: { role: 'body', weight: 400, size: 'md', tracking: 'normal', transform: 'none' },
  // Borrows the title family, so the kicker over a headline and the kicker over
  // a gallery finally read as the same device.
  eyebrow: { role: 'title', weight: 600, size: 'xs', tracking: '0.3em', transform: 'uppercase' },
  caption: { role: 'body', weight: 400, size: 'sm', tracking: '0.01em', transform: 'none' },
  data: { role: 'body', weight: 500, size: 'md', tracking: '0.02em', transform: 'none' },
} as const

export type RecipeName = keyof typeof RECIPE_DEFAULTS

export interface ResolvedRecipe {
  family: string
  weight: number
  size: string
  tracking: string
  transform: 'none' | 'uppercase'
  italic: boolean
}

/**
 * Rhythm: three relationships rather than one gap, because spacing carries
 * meaning. Things that belong together sit at `cluster`; a normal move between
 * blocks is `section`; `chapter` is a breath between movements.
 *
 * `section` deliberately equals the flat gap the page already used for each
 * density (16 / 32 / 48px), so adopting these values changes nothing that is
 * on a page today. `cluster` and `chapter` are new capability, not a rewrite.
 *
 * `inset` at normal density is 1rem for the same reason: every tile already
 * uses `px-4`, so a tile adopting the token keeps the margin it had.
 */
const RHYTHM_SCALE: Record<
  InviteSpacing,
  { cluster: string; section: string; chapter: string; inset: string }
> = {
  tight: { cluster: '0.5rem', section: '1rem', chapter: '2.5rem', inset: '0.75rem' },
  normal: { cluster: '0.75rem', section: '2rem', chapter: '4rem', inset: '1rem' },
  spacious: { cluster: '1rem', section: '3rem', chapter: '6rem', inset: '1.5rem' },
}

/**
 * Last-resort values for a config that says nothing - a brand new page, or a
 * preview of a layout that has not defined its own look.
 *
 * The colours and fonts are what the old default theme resolved to, so nothing
 * that previously fell through changes. Shape and depth are set to the values
 * already most common in the tiles: 12px surfaces (poster, directions and the
 * carousel all use it today), 8px controls (what `RADIUS_MAP.round` resolves
 * to, which is the fallback both button-bearing tiles use), and the subtle
 * shadow that both the gallery and the carousel default to. Adopting them
 * moves the outliers to meet the majority rather than imposing a new opinion.
 *
 * Controls are not pill by default. The timer renders a circle, which is a
 * shape rather than a control, and counting it as one is how an earlier pass
 * concluded that buttons were already round.
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
  buttonStyle: 'classic' as ButtonVariant,
  depth: 'uniform' as InviteDepth,
  spacing: 'normal' as InviteSpacing,
  material: 'solid' as InviteMaterial,
  textAlign: 'center' as InviteTextAlign,
  headerFont: "Georgia, 'Times New Roman', serif",
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
  /**
   * How buttons are drawn. Not a CSS value - it names a recipe that
   * `getButtonStyles` turns into classes and inline styles - so it travels by
   * context rather than as a custom property.
   */
  buttonStyle: ButtonVariant
  /** How high surfaces sit, after legacy vocabulary is folded in. */
  depth: InviteDepth
  /** Which tile is raised under `featured`; null when nothing qualifies. */
  featuredTileId: string | null
  /** What surfaces are made of. Contributes no shadow. */
  material: InviteMaterial
  surfaceFill: string
  surfaceBorder: string
  surfaceBlur: string
  surfaceInset: string
  /** Rules and flourishes, decided once for the invitation. */
  dividerStyle: 'none' | 'hairline' | 'symbol'
  dividerSymbol: string
  /** How the invitation is set. */
  textAlign: InviteTextAlign
  /** The six text roles, fully resolved. */
  recipes: Record<RecipeName, ResolvedRecipe>
}

/**
 * Which surface is raised when depth is `featured`.
 *
 * Semantic, not a free pick. A host told to choose "the special tile" chooses
 * the photographs, and the RSVP button stops being the thing the eye lands on.
 */
const FEATURED_PREFERENCE = ['event-details', 'feature-buttons', 'poster'] as const

function resolveFeaturedTileId(config?: Partial<InviteConfig> | null): string | null {
  if (config?.featuredTileId) return config.featuredTileId
  const tiles = (config?.tiles ?? []).filter((tile) => tile.enabled !== false)
  for (const type of FEATURED_PREFERENCE) {
    const match = tiles.find((tile) => tile.type === type)
    if (match) return match.id
  }
  return null
}

/** Resolve one text role, letting a host's own values win over the defaults. */
function resolveRole(role: FontRole | undefined, fallbackFamily: string): FontRole {
  return { ...(role ?? {}), family: role?.family || fallbackFamily }
}

function resolveRecipes(
  roles: { title: FontRole; header: FontRole; body: FontRole },
): Record<RecipeName, ResolvedRecipe> {
  const out = {} as Record<RecipeName, ResolvedRecipe>

  for (const [name, recipe] of Object.entries(RECIPE_DEFAULTS) as [
    RecipeName,
    (typeof RECIPE_DEFAULTS)[RecipeName],
  ][]) {
    const role = roles[recipe.role]
    const family = role.family
    // A script or display face keeps the family and drops the capitals: caps at
    // 0.3em is a convention for text faces, and illegible for a script one.
    const suppress = recipe.transform === 'uppercase' && isDisplayFamily(family)

    out[name] = {
      family,
      weight: role.weight ?? recipe.weight,
      size: TYPE_SCALE[role.size ?? recipe.size],
      tracking: suppress ? '0.04em' : role.tracking ?? recipe.tracking,
      transform: suppress ? 'none' : role.transform ?? recipe.transform,
      italic: role.italic ?? false,
    }
  }

  return out
}

/** Resolve the look an invite should render with. */
export function resolveAppearance(config?: Partial<InviteConfig> | null): InviteAppearance {
  const colors = config?.customColors ?? {}
  const fonts = config?.customFonts ?? {}

  const shape = SHAPE_SCALE[config?.shape ?? INVITE_APPEARANCE_DEFAULTS.shape]
    ?? SHAPE_SCALE[INVITE_APPEARANCE_DEFAULTS.shape]
  const depthName = resolveDepth(config?.depth)
  const depth = DEPTH_SCALE[depthName]
  const material = config?.material ?? INVITE_APPEARANCE_DEFAULTS.material
  const materialScale = MATERIAL_SCALE[material] ?? MATERIAL_SCALE.solid

  // Version 1 carried two bare families. `titleFont` becomes the title role;
  // `bodyFont` becomes both body and header, because a config that never had a
  // header face should not suddenly grow a second one.
  const titleFamily = fonts?.title?.family ?? fonts?.titleFont ?? INVITE_APPEARANCE_DEFAULTS.titleFont
  const bodyFamily = fonts?.body?.family ?? fonts?.bodyFont ?? INVITE_APPEARANCE_DEFAULTS.bodyFont
  const headerFamily = fonts?.header?.family ?? fonts?.bodyFont ?? INVITE_APPEARANCE_DEFAULTS.headerFont
  const roles = {
    title: resolveRole(fonts?.title, titleFamily),
    header: resolveRole(fonts?.header, headerFamily),
    body: resolveRole(fonts?.body, bodyFamily),
  }
  const rhythm = RHYTHM_SCALE[config?.spacing ?? INVITE_APPEARANCE_DEFAULTS.spacing]
    ?? RHYTHM_SCALE[INVITE_APPEARANCE_DEFAULTS.spacing]

  return {
    backgroundColor: colors.backgroundColor ?? INVITE_APPEARANCE_DEFAULTS.backgroundColor,
    backgroundGradient: colors.backgroundGradient,
    fontColor: colors.fontColor ?? INVITE_APPEARANCE_DEFAULTS.fontColor,
    primaryColor: colors.primaryColor ?? INVITE_APPEARANCE_DEFAULTS.primaryColor,
    mutedColor: colors.mutedColor ?? INVITE_APPEARANCE_DEFAULTS.mutedColor,
    titleFont: titleFamily,
    bodyFont: bodyFamily,
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
    buttonStyle: config?.buttonStyle ?? INVITE_APPEARANCE_DEFAULTS.buttonStyle,
    depth: depthName,
    featuredTileId: depthName === 'featured' ? resolveFeaturedTileId(config) : null,
    material,
    surfaceFill: materialScale.fill,
    surfaceBorder: materialScale.border,
    surfaceBlur: materialScale.blur,
    surfaceInset: materialScale.inset,
    dividerStyle: config?.ornament?.divider ?? 'hairline',
    dividerSymbol: config?.ornament?.symbol ?? '',
    textAlign: config?.textAlign ?? INVITE_APPEARANCE_DEFAULTS.textAlign,
    recipes: resolveRecipes(roles),
  }
}
