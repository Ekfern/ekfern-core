'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import FontPicker from '@/components/invite/FontPicker'
import type { InviteConfig } from '@/lib/invite/schema'
import { deriveInk, representativeColorFromGradient } from '@/lib/invite/paletteUtils'
import { colorInputValue } from '@/lib/invite/colorInputValue'

/**
 * Look & Style — fonts, ink colours, button style, corners, shadows, card
 * style, text alignment, dividers and the page border.
 *
 * Shared by the host's page editor and the staff page layout studio. Like the
 * background panel it only reads and writes `config`, so neither surface needs
 * to know anything about the other. The studio had none of this: a designer
 * could not set the fonts or accent colour a layout ships with.
 */

// Tiles no longer carry a face of their own, so there is nothing to match back
// to the page. The list is kept empty rather than deleted because the carousel
// still has `subEventTitleStyling.font` to give up.
const FONT_LINKED_TILE_KEYS = [] as const

type FontRoleName = 'title' | 'header' | 'body'
type PageFonts = NonNullable<InviteConfig['customFonts']>

/**
 * The face a role is set to.
 *
 * Reads the version 1 spelling when the role itself has not been written yet.
 * `header` falls back to the body face on purpose: a config that never had a
 * header face should not look like it already chose one.
 */
function roleFamily(fonts: InviteConfig['customFonts'], role: FontRoleName): string | undefined {
  if (!fonts) return undefined
  if (role === 'title') return fonts.title?.family ?? fonts.titleFont
  if (role === 'body') return fonts.body?.family ?? fonts.bodyFont
  // Nothing when unset, so the control can say "Same as headline" - which is
  // what actually happens. Falling back to the body face here showed Courier in
  // a picker whose headings were rendering in Pacifico.
  return fonts.header?.family
}

/** Set one role's family, leaving the rest of its recipe alone. */
function withRoleFamily(
  fonts: InviteConfig['customFonts'],
  role: FontRoleName,
  family: string | undefined,
): PageFonts {
  const next: PageFonts = { ...(fonts ?? {}) }
  if (family) next[role] = { ...(next[role] ?? {}), family }
  else delete next[role]
  return next
}

// What is left after the text colours went. Each of these still overrides the
// page, and each leaves in a later pass.
const PALETTE_LINKED_TILE_KEYS = [
  'buttonColor',    // details, feature-buttons -> --theme-primary
  'circleColor',    // timer      -> --theme-primary
  'borderColor',    // details    -> --theme-muted
] as const

interface LookAndStyleSettingsProps {
  config: InviteConfig
  setConfig: React.Dispatch<React.SetStateAction<InviteConfig>>
  /** Studio opens it by default; the page editor keeps it collapsed. */
  defaultOpen?: boolean
  /**
   * Extra controls rendered at the end of the expanded section. The studio
   * puts its staff-only frame art and corner decorations here so they read as
   * part of Look & Style rather than a section of their own — while staying
   * out of the host's copy.
   */
  children?: React.ReactNode
}

export default function LookAndStyleSettings({
  config,
  setConfig,
  defaultOpen = false,
  children,
}: LookAndStyleSettingsProps) {
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(defaultOpen)

  const tilesOverridingFonts = (config.tiles ?? []).filter(tile => {
    const settings = tile.settings as Record<string, unknown> | undefined
    return !!settings && FONT_LINKED_TILE_KEYS.some(key => settings[key])
  }).length

  // A host touching any ink directly takes ownership of the set.
  const applyInkColor = (patch: {
    titleColor?: string
    headerColor?: string
    fontColor?: string
    primaryColor?: string
    mutedColor?: string
  }) => {
    setConfig(prev => ({
      ...prev,
      customColors: { ...(prev.customColors ?? {}), ...patch, source: 'custom' as const },
    }))
  }

  return (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    className="flex items-center justify-between w-full text-left focus:outline-none focus:ring-2 focus:ring-eco-green rounded-md p-2 -m-2"
                  >
                    <h3 className="text-sm font-semibold text-eco-green">Look &amp; Style</h3>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${showAdvancedSettings ? 'transform rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showAdvancedSettings && (
                    <div className="mt-4 space-y-4">
                      {/* Button style is page-level: an invitation with two button
                          shapes reads as a mistake. Both the RSVP buttons and Save
                          the Date take this unless a tile overrides it. */}
                      <div>
                        <label htmlFor="page-buttonStyle" className="block text-sm font-medium mb-2">
                          Button style
                        </label>
                        <select
                          id="page-buttonStyle"
                          value={config.buttonStyle ?? 'classic'}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            buttonStyle: e.target.value as NonNullable<typeof prev.buttonStyle>,
                          }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                        >
                          {([
                            ['classic', 'Classic'], ['soft', 'Soft'], ['raised', 'Raised'],
                            ['gloss', 'Gloss'], ['metal', 'Metal'], ['glow', 'Glow'],
                            ['glass', 'Glass'], ['bracket', 'Bracket'], ['ornate', 'Ornate'],
                            ['link', 'Link (text only)'],
                          ] as const).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Applies to RSVP, Registry and Save the Date together.
                        </p>
                      </div>

                      {/* Two faces, because that is how many an invitation has: the
                          one the names are set in, and the one everything else uses. */}
                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium">Fonts</label>
                          {tilesOverridingFonts > 0 && (
                            <button
                              type="button"
                              onClick={() => setConfig(prev => ({
                                ...prev,
                                tiles: (prev.tiles ?? []).map(tile => {
                                  const settings = tile.settings as Record<string, unknown> | undefined
                                  if (!settings) return tile
                                  const cleared = { ...settings }
                                  for (const key of FONT_LINKED_TILE_KEYS) delete cleared[key]
                                  return { ...tile, settings: cleared } as typeof tile
                                }),
                              }))}
                              title="Some tiles have a font of their own, so they ignore the choices above. This returns them to these fonts."
                              className="text-xs text-eco-green underline hover:no-underline"
                            >
                              Match {tilesOverridingFonts} {tilesOverridingFonts === 1 ? 'tile' : 'tiles'} to these fonts
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            ['title', 'Title', 'The names on your invitation, plus the small lines that go with them \u2014 kickers like "You\u2019re invited", and photo captions.'],
                            ['header', 'Header', 'The heading over your photos, and your sub-event titles. Follows the title until you change it.'],
                            ['body', 'Content text', 'Dates, location, description, buttons and footer \u2014 all the running text.'],
                          ] as const).map(([key, label, hint]) => (
                            <div key={key} className="relative group">
                              <label
                                htmlFor={`page-${key}`}
                                tabIndex={0}
                                className="block text-xs text-gray-600 mb-1 cursor-help underline decoration-dotted decoration-gray-300 underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-eco-green rounded"
                              >
                                {label}
                              </label>
                              <div
                                role="tooltip"
                                className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-52 rounded-md bg-gray-900 px-2.5 py-2 text-xs leading-snug text-white shadow-lg group-hover:block group-focus-within:block"
                              >
                                {hint}
                              </div>
                              <FontPicker
                                id={`page-${key}`}
                                ariaLabel={`${label} font. ${hint}`}
                                value={roleFamily(config.customFonts, key)}
                                onChange={(family) => setConfig(prev => ({
                                  ...prev,
                                  customFonts: withRoleFamily(prev.customFonts, key, family),
                                }))}
                                defaultLabel={key === 'header' ? 'Same as title' : 'Layout default'}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Ink, accent and muted. These follow the background until a
                          host sets one, which is what the "Following the background"
                          note is telling them. */}
                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium">Colours</label>
                          {config.customColors?.source === 'custom' ? (
                            <button
                              type="button"
                              onClick={() => {
                                const ground = config.customColors?.backgroundGradient
                                  ? representativeColorFromGradient(config.customColors.backgroundGradient)
                                  : config.customColors?.backgroundColor
                                if (!ground) return
                                setConfig(prev => ({
                                  ...prev,
                                  customColors: {
                                    ...(prev.customColors ?? {}),
                                    ...deriveInk({
                                      backgroundColor: prev.customColors?.backgroundColor,
                                      backgroundGradient: prev.customColors?.backgroundGradient,
                                      material: prev.material,
                                    }),
                                    source: 'derived' as const,
                                  },
                                  // Tiles carrying their own colour would keep
                                  // overriding the page, so matching the page
                                  // alone would appear to do nothing. Clearing
                                  // these hands each tile back to the palette:
                                  // every one of them already falls back to a
                                  // theme token, so each lands on the right
                                  // colour for its own job - the footer on
                                  // Secondary, the buttons on Accent.
                                  tiles: (prev.tiles ?? []).map(tile => {
                                    const settings = tile.settings as Record<string, unknown> | undefined
                                    if (!settings) return tile
                                    const cleared = { ...settings }
                                    for (const key of PALETTE_LINKED_TILE_KEYS) delete cleared[key]
                                    return { ...tile, settings: cleared } as typeof tile
                                  }),
                                }))
                              }}
                              title="Puts the text and accent colours back in step with the background, and returns any tile you have recoloured to the page colours."
                              className="text-xs text-eco-green underline hover:no-underline"
                            >
                              Match to background
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">Following the background</span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {/* Each hint names what the colour actually paints, so a host can
                              tell which swatch to move without guessing from its name. */}
                          {([
                            ['titleColor', 'Title', '#1F1B16',
                              'The same text the Title font sets \u2014 your names, the kicker above them, and photo captions.'],
                            ['headerColor', 'Header', '#1F1B16',
                              'The same text the Header font sets. Follows the title until you change it.'],
                            ['fontColor', 'Content text', '#1F1B16',
                              'The same text the Content text font sets \u2014 dates, location, description and footer.'],
                            // Accent sits in the Header column: it is the same
                            // register of the invitation, used where a heading
                            // would be if it were a control rather than words.
                            ['primaryColor', 'Accent', '#A6815B',
                              'Buttons like RSVP and Save the Date, and the countdown circles.'],
                          ] as const).map(([key, label, fallback, hint]) => (
                            <div
                              key={key}
                              className={`relative group ${key === 'primaryColor' ? 'col-start-2' : ''}`}
                            >
                              <label
                                htmlFor={`page-${key}`}
                                tabIndex={0}
                                className="block text-xs text-gray-600 mb-1 cursor-help underline decoration-dotted decoration-gray-300 underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-eco-green rounded"
                              >
                                {label}
                              </label>
                              {/* Shown on hover and on keyboard focus. A native `title`
                                  needs a second of hovering and renders inconsistently,
                                  which reads as "nothing happened". */}
                              <div
                                role="tooltip"
                                className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-52 rounded-md bg-gray-900 px-2.5 py-2 text-xs leading-snug text-white shadow-lg group-hover:block group-focus-within:block"
                              >
                                {hint}
                              </div>
                              <input
                                id={`page-${key}`}
                                type="color"
                                aria-label={`${label} colour. ${hint}`}
                                value={colorInputValue(config.customColors?.[key], fallback)}
                                onChange={(e) => applyInkColor({ [key]: e.target.value })}
                                className="h-9 w-full rounded border border-gray-300"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Spacing between tiles</label>
                        <select
                          value={config.spacing || 'normal'}
                          onChange={(e) => setConfig(prev => ({ ...prev, spacing: e.target.value as 'tight' | 'normal' | 'spacious' }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                        >
                          <option value="tight">Tight</option>
                          <option value="normal">Normal</option>
                          <option value="spacious">Spacious</option>
                        </select>
                      </div>

                      {/* Shape, depth, material, alignment and rules. All five were
                          already answerable in the config and none had a control, so
                          the only way to set them was to author a layout - which is
                          how an invitation ended up with two cards raised by accident.
                          Every label says what a host would say, not what CSS calls it. */}
                      <div>
                        <label htmlFor="page-shape" className="block text-sm font-medium mb-2">Corners</label>
                        <select
                          id="page-shape"
                          value={config.shape ?? 'soft'}
                          onChange={(e) => setConfig(prev => ({ ...prev, shape: e.target.value as NonNullable<typeof prev.shape> }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                        >
                          <option value="sharp">Square</option>
                          <option value="soft">Softly rounded</option>
                          <option value="rounded">Fully rounded</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Cards, photos and buttons together.</p>
                      </div>

                      <div>
                        <label htmlFor="page-depth" className="block text-sm font-medium mb-2">Card shadows</label>
                        <select
                          id="page-depth"
                          value={config.depth === 'raised' || config.depth === 'lifted' ? 'uniform' : config.depth ?? 'uniform'}
                          onChange={(e) => setConfig(prev => ({ ...prev, depth: e.target.value as NonNullable<typeof prev.depth> }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                        >
                          <option value="flat">None &mdash; everything sits flat</option>
                          <option value="uniform">Every card lifts a little</option>
                          <option value="featured">One card stands out</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          {config.depth === 'featured'
                            ? 'Your event details lift off the page; everything else lies flat.'
                            : 'Applies to every card on the invitation, so none of them lifts by accident.'}
                        </p>
                      </div>

                      <div>
                        <label htmlFor="page-material" className="block text-sm font-medium mb-2">Card style</label>
                        <select
                          id="page-material"
                          value={config.material ?? 'solid'}
                          onChange={(e) => setConfig(prev => ({ ...prev, material: e.target.value as NonNullable<typeof prev.material> }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                        >
                          <option value="solid">Plain</option>
                          <option value="glass">Frosted glass</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="page-textAlign" className="block text-sm font-medium mb-2">Text alignment</label>
                        <select
                          id="page-textAlign"
                          value={config.textAlign ?? 'center'}
                          onChange={(e) => setConfig(prev => ({ ...prev, textAlign: e.target.value as NonNullable<typeof prev.textAlign> }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                        >
                          <option value="center">Centred</option>
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Centred reads formal; left reads like a magazine.</p>
                      </div>

                      <div>
                        <label htmlFor="page-divider" className="block text-sm font-medium mb-2">Dividers</label>
                        <select
                          id="page-divider"
                          value={config.ornament?.divider ?? 'hairline'}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            ornament: { ...(prev.ornament ?? {}), divider: e.target.value as 'none' | 'hairline' | 'symbol' },
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                        >
                          <option value="none">None</option>
                          <option value="hairline">Thin line</option>
                          <option value="symbol">Small symbol</option>
                        </select>
                        {config.ornament?.divider === 'symbol' && (
                          <div className="mt-2 flex gap-1">
                            {['\u2766', '\u273F', '\u2724', '\u2726', '\u2022', '\u2014'].map((symbol) => (
                              <button
                                key={symbol}
                                type="button"
                                aria-label={`Use ${symbol} as the divider`}
                                aria-pressed={(config.ornament?.symbol ?? '\u2766') === symbol}
                                onClick={() => setConfig(prev => ({
                                  ...prev,
                                  ornament: { ...(prev.ornament ?? {}), divider: 'symbol', symbol },
                                }))}
                                className={`h-8 w-8 rounded border text-sm ${
                                  (config.ornament?.symbol ?? '\u2766') === symbol
                                    ? 'border-eco-green bg-green-50'
                                    : 'border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {symbol}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Page Border Settings */}
                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium">Page Border</label>
                          <input
                            type="checkbox"
                            checked={config.pageBorder?.enabled || false}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              pageBorder: {
                                ...prev.pageBorder,
                                enabled: e.target.checked,
                                style: prev.pageBorder?.style || 'solid',
                                color: prev.pageBorder?.color ?? '#D1D5DB',
                                width: prev.pageBorder?.width ?? 2,
                              },
                            }))}
                            className="w-4 h-4 accent-eco-green border-gray-300 rounded"
                          />
                        </div>
                        {config.pageBorder?.enabled && (
                          <div className="mt-3 space-y-3">
                            <div>
                              <label className="block text-sm font-medium mb-2">Border Style</label>
                              <select
                                value={config.pageBorder?.style || 'solid'}
                                onChange={(e) => setConfig(prev => ({
                                  ...prev,
                                  pageBorder: {
                                    ...prev.pageBorder,
                                    style: e.target.value as any,
                                  },
                                }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
                              >
                                <option value="solid">Solid</option>
                                <option value="dotted">Dotted</option>
                                <option value="dashed">Dashed</option>
                                <option value="double">Double</option>
                                <option value="groove">Groove</option>
                                <option value="ridge">Ridge</option>
                                <option value="inset">Inset</option>
                                <option value="outset">Outset</option>
                                <option value="intaglio">Intaglio (Decorative)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Border colour</label>
                              <p className="text-xs text-gray-500 mb-2">
                                Also colours the fine rules inside your event details card, so
                                every line on the invitation matches.
                              </p>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={colorInputValue(config.pageBorder?.color, '#D1D5DB')}
                                  onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    pageBorder: {
                                      ...prev.pageBorder,
                                      color: e.target.value,
                                    },
                                  }))}
                                  className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
                                />
                                <Input
                                  type="text"
                                  value={config.pageBorder?.color ?? ''}
                                  onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    pageBorder: {
                                      ...prev.pageBorder,
                                      color: e.target.value,
                                    },
                                  }))}
                                  placeholder="#D1D5DB"
                                  className="flex-1"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">
                                Border Width: {config.pageBorder?.width ?? 2}px
                              </label>
                              <input
                                type="range"
                                min="1"
                                max="8"
                                value={config.pageBorder?.width ?? 2}
                                onChange={(e) => setConfig(prev => ({
                                  ...prev,
                                  pageBorder: {
                                    ...prev.pageBorder,
                                    width: parseInt(e.target.value),
                                  },
                                }))}
                                className="w-full"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {children}

                    </div>
                  )}
                </div>
  )
}
