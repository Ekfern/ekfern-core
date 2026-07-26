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

export interface HarmoniousPalette {
  backgroundColor?: string
  backgroundGradient?: string
  fontColor: string
  primaryColor: string
}

/**
 * Derive a full, contrast-checked palette (background + legible text +
 * accent) from a chosen background image or gradient. This is what makes a
 * background pick in the Design step cascade coherently, instead of only
 * updating the page background color.
 */
export async function deriveHarmoniousPalette(
  bgUrl: string | null | undefined,
  bgGradient: string | null | undefined,
): Promise<HarmoniousPalette> {
  if (bgGradient) {
    const rep = representativeColorFromGradient(bgGradient)
    const dark = isDarkHex(rep)
    return {
      backgroundGradient: bgGradient,
      fontColor: dark ? '#FFFFFF' : DEFAULT_TEXT,
      primaryColor: dark ? '#E8D8C3' : DEFAULT_ACCENT,
    }
  }

  if (bgUrl) {
    try {
      const colors = await extractDominantColors(bgUrl, 2)
      const primary = rgbToHex(colors[0] ?? 'rgb(232,216,195)')
      const accent = colors[1] ? rgbToHex(colors[1]) : DEFAULT_ACCENT
      const dark = isDarkHex(primary)
      return {
        backgroundColor: primary,
        fontColor: dark ? '#FFFFFF' : DEFAULT_TEXT,
        primaryColor: accent,
      }
    } catch {
      /* fall through to default */
    }
  }

  return {
    backgroundColor: DEFAULT_BG,
    fontColor: DEFAULT_TEXT,
    primaryColor: DEFAULT_ACCENT,
  }
}
