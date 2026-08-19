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
  const hexMatch = gradient.match(/#([0-9A-Fa-f]{6})/)
  if (hexMatch) return `#${hexMatch[1]}`
  const rgbMatch = gradient.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/)
  if (rgbMatch) {
    return rgbToHex(`rgb(${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]})`)
  }
  return DEFAULT_BG
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
export function derivePaletteFromColor(background: string): DerivedInk {
  const dark = isDarkHex(background)
  const ink = dark ? '#FFFFFF' : DEFAULT_TEXT
  return {
    fontColor: ink,
    primaryColor: dark ? '#E8D8C3' : DEFAULT_ACCENT,
    mutedColor: mutedFrom(ink, background),
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
    const rep = representativeColorFromGradient(bgGradient)
    const dark = isDarkHex(rep)
    const ink = dark ? '#FFFFFF' : DEFAULT_TEXT
    return {
      backgroundGradient: bgGradient,
      fontColor: ink,
      primaryColor: dark ? '#E8D8C3' : DEFAULT_ACCENT,
      mutedColor: mutedFrom(ink, rep),
    }
  }

  if (bgUrl) {
    try {
      const colors = await extractDominantColors(bgUrl, 2)
      const primary = rgbToHex(colors[0] ?? 'rgb(232,216,195)')
      const accent = colors[1] ? rgbToHex(colors[1]) : DEFAULT_ACCENT
      const dark = isDarkHex(primary)
      const ink = dark ? '#FFFFFF' : DEFAULT_TEXT
      return {
        backgroundColor: primary,
        fontColor: ink,
        primaryColor: accent,
        mutedColor: mutedFrom(ink, primary),
      }
    } catch {
      /* fall through to default */
    }
  }

  return {
    backgroundColor: DEFAULT_BG,
    fontColor: DEFAULT_TEXT,
    primaryColor: DEFAULT_ACCENT,
    mutedColor: mutedFrom(DEFAULT_TEXT, DEFAULT_BG),
  }
}
