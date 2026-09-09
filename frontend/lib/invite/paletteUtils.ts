/**
 * Shared color-contrast helpers for deriving a coherent page palette from a
 * chosen background (image or gradient) — used by the Design step and by
 * the mechanical starter layouts.
 */

import { extractDominantColors, rgbToHex } from '@/lib/invite/imageAnalysis'

const DEFAULT_BG = '#E8D8C3'
const DEFAULT_ACCENT = '#A6815B'
const DEFAULT_TEXT = '#1F1B16'

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9A-Fa-f]{6})$/.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** Relative luminance (0–1); used to pick light vs dark text on a background. */
export function hexLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0.5
  const toLin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * toLin(rgb.r) + 0.7152 * toLin(rgb.g) + 0.0722 * toLin(rgb.b)
}

export function isDarkHex(hex: string): boolean {
  return hexLuminance(hex) < 0.45
}

/** Pull a representative hex from a CSS gradient for contrast checks. */
export function representativeColorFromGradient(gradient: string): string {
  return gradientStops(gradient)[0] ?? DEFAULT_BG
}

/**
 * Every colour stop in a CSS gradient, in the order written.
 *
 * The previous reading took the first stop and stopped looking, which is fine
 * for choosing a representative colour and wrong for checking contrast: ink
 * picked against a pale first stop can be invisible by the last one.
 */
export function gradientStops(gradient: string): string[] {
  const stops: string[] = []
  const pattern = /#([0-9A-Fa-f]{6})|rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g
  let match = pattern.exec(gradient)
  while (match) {
    // Upper-cased on the way out: `mixHex` produces upper and `rgbToHex`
    // lower, so the same colour arriving by two routes would otherwise count
    // as two surfaces.
    stops.push(
      (match[1] ? `#${match[1]}` : rgbToHex(`rgb(${match[2]},${match[3]},${match[4]})`)).toUpperCase(),
    )
    match = pattern.exec(gradient)
  }
  return stops
}

/**
 * The WCAG contrast ratio between two colours, 1 (identical) to 21 (black on
 * white).
 *
 * `isDarkHex` answers a different and weaker question - which side of a
 * luminance threshold a colour sits on. A background can be "light" by that
 * test and still leave dark ink below 4.5:1.
 */
export function contrastRatio(a: string, b: string): number {
  const la = hexLuminance(a)
  const lb = hexLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * The floors ink has to clear. Large text is held to a lower bar because it is
 * easier to read at the same ratio, which is WCAG's own concession.
 */
export const CONTRAST_FLOOR = {
  /** Running text, captions, labels - anything at body size or below. */
  body: 4.5,
  /** Titles and section headings. */
  large: 3,
} as const

/** Flatten a translucent fill over a backdrop, so glass is measured honestly. */
export function compositeOver(fill: string, alpha: number, backdrop: string): string {
  return mixHex(backdrop, fill, Math.min(1, Math.max(0, alpha)))
}

function unique(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index)
}

/** The translucent white a glass card lays over the page. */
const GLASS_FILL = '#FFFFFF'
const GLASS_ALPHA = 0.14

/**
 * Every surface a page's ink actually has to survive.
 *
 * A flat background is one surface. A gradient is two - its lightest and its
 * darkest stop - because ink that clears the average can still fail at one end.
 * A glass card adds the composite of its fill over each of those, since text on
 * a frosted card sits on the blend, not on the page.
 */
export function contrastSurfaces(opts: {
  backgroundColor?: string | null
  backgroundGradient?: string | null
  material?: 'solid' | 'glass' | null
}): string[] {
  const stops = opts.backgroundGradient ? gradientStops(opts.backgroundGradient) : []
  const base = stops.length
    ? [...stops].sort((a, b) => hexLuminance(a) - hexLuminance(b)).filter((_, i, all) =>
        i === 0 || i === all.length - 1,
      )
    : [opts.backgroundColor || DEFAULT_BG]

  const surfaces = unique(base)
  if (opts.material === 'glass') {
    surfaces.push.apply(
      surfaces,
      surfaces.map((surface) => compositeOver(GLASS_FILL, GLASS_ALPHA, surface)),
    )
  }
  return unique(surfaces)
}

/** The worst ratio `ink` achieves across every surface it has to sit on. */
export function worstContrast(ink: string, surfaces: string[]): number {
  return surfaces.reduce((worst, surface) => Math.min(worst, contrastRatio(ink, surface)), Infinity)
}

/**
 * Push ink away from its surfaces until it clears the floor everywhere.
 *
 * Ink is walked towards black and towards white in parallel; the first step
 * that clears every surface wins, and the direction that got furthest wins if
 * neither does. Returning the best failing candidate rather than the original
 * matters - a palette that cannot reach 4.5:1 should still hand back the most
 * legible ink it found, not the least.
 */
export function ensureContrast(
  ink: string,
  surfaces: string[],
  minRatio: number = CONTRAST_FLOOR.body,
): string {
  if (!surfaces.length || worstContrast(ink, surfaces) >= minRatio) return ink

  let best = ink
  let bestRatio = worstContrast(ink, surfaces)

  for (let step = 1; step <= 20; step += 1) {
    for (const target of ['#000000', '#FFFFFF']) {
      const candidate = mixHex(ink, target, step / 20)
      const ratio = worstContrast(candidate, surfaces)
      if (ratio >= minRatio) return candidate
      if (ratio > bestRatio) {
        best = candidate
        bestRatio = ratio
      }
    }
  }

  return best
}

/** Blend two hexes; `amount` is how far from `a` towards `b`. */
export function mixHex(a: string, b: string, amount: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  if (!ca || !cb) return a
  const t = Math.min(1, Math.max(0, amount))
  const ch = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `#${[ch(ca.r, cb.r), ch(ca.g, cb.g), ch(ca.b, cb.b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase()
}

export interface HarmoniousPalette {
  backgroundColor?: string
  backgroundGradient?: string
  fontColor: string
  primaryColor: string
  /** The quiet one - labels, captions, dividers. */
  mutedColor: string
}

/**
 * Muted is the ink, pulled part-way back towards the paper. Deriving it rather
 * than naming a constant is what keeps it legible on any background: on a dark
 * page it settles light, on a pale one it settles dark, and it never drifts to
 * a hue that has nothing to do with the rest of the palette.
 */
function mutedFrom(fontColor: string, background: string): string {
  return mixHex(fontColor, background, 0.42)
}

/** The three colours that have to answer to whatever the background is. */
export interface DerivedInk {
  fontColor: string
  primaryColor: string
  mutedColor: string
}

/**
 * Derive ink, accent and muted from a settled background colour.
 *
 * Synchronous, because by the time a host has picked a colour there is nothing
 * left to inspect - only the image path needs to go and look at pixels.
 */
export function derivePaletteFromColor(
  background: string,
  material: 'solid' | 'glass' | null = 'solid',
): DerivedInk {
  return deriveInk({ backgroundColor: background, material })
}

/**
 * Ink, accent and muted, guaranteed against every surface they land on.
 *
 * Choosing by luminance alone got the direction right and the amount wrong:
 * white on a mid-tone page is "light ink on a dark background" and still under
 * 4.5:1. Each colour is now pushed until it clears its floor, and muted is
 * checked rather than assumed - it is ink mixed 42% back towards the paper,
 * which is exactly the move most likely to drop below the line.
 *
 * Accent is held to the large-text floor. It paints the kicker and the button
 * fills, and holding a host's chosen accent to 4.5:1 against the page would
 * quietly repaint half the palettes anyone picks.
 */
export function deriveInk(opts: {
  backgroundColor?: string | null
  backgroundGradient?: string | null
  material?: 'solid' | 'glass' | null
}): DerivedInk {
  const surfaces = contrastSurfaces(opts)
  const reference = opts.backgroundGradient
    ? representativeColorFromGradient(opts.backgroundGradient)
    : opts.backgroundColor || DEFAULT_BG
  const dark = isDarkHex(reference)

  const fontColor = ensureContrast(dark ? '#FFFFFF' : DEFAULT_TEXT, surfaces, CONTRAST_FLOOR.body)
  return {
    fontColor,
    primaryColor: ensureContrast(
      dark ? '#E8D8C3' : DEFAULT_ACCENT,
      surfaces,
      CONTRAST_FLOOR.large,
    ),
    mutedColor: ensureContrast(mutedFrom(fontColor, reference), surfaces, CONTRAST_FLOOR.body),
  }
}

/**
 * Derive a full, contrast-checked palette - background, legible ink, accent
 * and muted - from a chosen background image or gradient.
 *
 * This existed for a long time with no callers, which is why an invitation
 * could end up with a lilac accent on a cream page: the background control
 * updated one of five colours that a preset had chosen together, and the other
 * four kept the values that suited a background nobody could see any more.
 */
export async function deriveHarmoniousPalette(
  bgUrl: string | null | undefined,
  bgGradient: string | null | undefined,
): Promise<HarmoniousPalette> {
  if (bgGradient) {
    return { backgroundGradient: bgGradient, ...deriveInk({ backgroundGradient: bgGradient }) }
  }

  if (bgUrl) {
    try {
      const colors = await extractDominantColors(bgUrl, 2)
      const primary = rgbToHex(colors[0] ?? 'rgb(232,216,195)')
      const accent = colors[1] ? rgbToHex(colors[1]) : DEFAULT_ACCENT
      const surfaces = contrastSurfaces({ backgroundColor: primary })
      const ink = ensureContrast(
        isDarkHex(primary) ? '#FFFFFF' : DEFAULT_TEXT,
        surfaces,
        CONTRAST_FLOOR.body,
      )
      return {
        backgroundColor: primary,
        fontColor: ink,
        // The accent came out of the photograph, so it is pushed only as far as
        // it has to go rather than replaced with a stock colour.
        primaryColor: ensureContrast(accent, surfaces, CONTRAST_FLOOR.large),
        mutedColor: ensureContrast(mutedFrom(ink, primary), surfaces, CONTRAST_FLOOR.body),
      }
    } catch {
      /* fall through to default */
    }
  }

  return { backgroundColor: DEFAULT_BG, ...deriveInk({ backgroundColor: DEFAULT_BG }) }
}
