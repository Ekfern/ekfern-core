'use client'

import React, { createContext, useContext, useMemo } from 'react'
import { InviteConfig } from '@/lib/invite/schema'
import { resolveAppearance } from '@/lib/invite/appearance'
import type { ButtonVariant } from '@/lib/invite/buttonStyles'
import type { InviteDepth, InviteMaterial } from '@/lib/invite/appearance'

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
 * Almost everything travels as a custom property, because almost everything is
 * a CSS value. Button style is the exception: it names a recipe that
 * `getButtonStyles` turns into class names and inline styles, which no variable
 * can carry. That one value goes by context instead.
 *
 * (An earlier `useTheme()` context published the whole palette a second time and
 * had a single caller that used it to re-apply overrides `resolveAppearance`
 * had already applied. This is deliberately not that: it carries only what a
 * custom property cannot.)
 */
interface PageDesign {
  /** How every button on the invitation is drawn. */
  buttonStyle: ButtonVariant
  /**
   * How high surfaces sit. A tile asks this to decide whether it is the raised
   * one, not to decide what raised looks like - that is `--shadow-lift`.
   */
  depth: InviteDepth
  /**
   * The one raised surface under `featured`. A tile compares its own id and
   * takes `--shadow-lift` on a match, `--shadow-rest` otherwise.
   */
  featuredTileId: string | null
  /** What surfaces are made of. Never a shadow. */
  material: InviteMaterial
  /** Rules and flourishes, decided once. */
  dividerStyle: 'none' | 'hairline' | 'symbol'
  dividerSymbol: string
}

const PageDesignContext = createContext<PageDesign | undefined>(undefined)

/**
 * The page-level design decisions that are not CSS values.
 *
 * Returns undefined outside a provider - the server-rendered hero, for one - so
 * callers fall back to their own setting rather than crashing.
 */
export function usePageDesign(): PageDesign | undefined {
  return useContext(PageDesignContext)
}

interface AppearanceProviderProps {
  config?: InviteConfig
  children: React.ReactNode
}

export function AppearanceProvider({ config, children }: AppearanceProviderProps) {
  const colors = resolveAppearance(config)
  const design = useMemo<PageDesign>(
    () => ({
      buttonStyle: colors.buttonStyle,
      depth: colors.depth,
      featuredTileId: colors.featuredTileId,
      material: colors.material,
      dividerStyle: colors.dividerStyle,
      dividerSymbol: colors.dividerSymbol,
    }),
    [
      colors.buttonStyle,
      colors.depth,
      colors.featuredTileId,
      colors.material,
      colors.dividerStyle,
      colors.dividerSymbol,
    ],
  )

  // One entry per recipe, flattened to custom properties. A tile spends five of
  // them at a time and never asks what any of them should be.
  const recipeVars = Object.fromEntries(
    Object.entries(colors.recipes).flatMap(([name, recipe]) => [
      [`--font-${name}-family`, recipe.family],
      [`--font-${name}-weight`, String(recipe.weight)],
      [`--font-${name}-size`, recipe.size],
      [`--font-${name}-tracking`, recipe.tracking],
      [`--font-${name}-transform`, recipe.transform],
      [`--font-${name}-style`, recipe.italic ? 'italic' : 'normal'],
      [`--font-${name}-color`, recipe.color],
    ]),
  )

  return (
    <PageDesignContext.Provider value={design}>
    <div
      style={{
        // Applied, not just published. Tiles that never mention a font used to
        // inherit whatever the document gave them - Tailwind's sans stack - so
        // a host could choose Lora and watch half the invitation ignore it.
        // Setting it here means a tile opts *out* to be different, rather than
        // having to opt in to be correct.
        fontFamily: colors.recipes.body.family,

        '--theme-fg': colors.fontColor,
        '--theme-primary': colors.primaryColor,
        '--theme-muted': colors.mutedColor,
        // The last reader of the old spelling is the carousel's own title
        // styling, which goes in the carousel pass. `--theme-font-body` had
        // none left and is gone already.
        '--theme-font-title': colors.titleFont,

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

        // Material: what a surface is made of, kept apart from how high it
        // sits. Glass adds fill, border and blur; the shadow still comes from
        // depth, so a glass card on a flat page casts nothing.
        '--surface-fill': colors.surfaceFill,
        '--surface-border': colors.surfaceBorder,
        '--surface-blur': colors.surfaceBlur,
        '--surface-inset': colors.surfaceInset,

        // How the invitation is set, answered once rather than by five tiles.
        '--invite-align': colors.textAlign,

        // The six text recipes.
        ...recipeVars,

        // Under `featured`, one surface rises and the rest lie flat. Publishing
        // it against the tile's own id means a tile asks the same question
        // wherever it is rendered - inside the renderer, inside the editor's
        // preview, or server-side - and never has to be told it is the special
        // one.
        ...(colors.depth === 'featured' && colors.featuredTileId
          ? { [`--lift-${colors.featuredTileId}`]: 'var(--shadow-lift)' }
          : {}),
      } as React.CSSProperties}
    >
      {children}
    </div>
    </PageDesignContext.Provider>
  )
}
