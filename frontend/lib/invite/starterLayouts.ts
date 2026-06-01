/**
 * Pure mechanical starter page layouts for hosts when no staff-published
 * layouts exist for their selected design code. Client-only — not persisted.
 */

import type { SelectedDesignContext } from '@/lib/invite/designContext'
import { extractDominantColors, rgbToHex } from '@/lib/invite/imageAnalysis'
import type { InvitePageLayout } from '@/lib/invite/pageLayouts'
import type { InviteConfig, Tile, TileType } from '@/lib/invite/schema'

export const STARTER_TITLE = "You're Invited"
export const STARTER_SUBTITLE = 'Join us to celebrate'

const FALLBACK_BG = '#E8D8C3'
const FALLBACK_ACCENT = '#A6815B'
const FALLBACK_TEXT = '#1F1B16'
const TITLE_FONT = "'Playfair Display', serif"
const BODY_FONT = 'Inter, system-ui, sans-serif'

export function isStarterLayoutId(id: string): boolean {
  return id.startsWith('starter-')
}

interface StarterPalette {
  customColors: NonNullable<InviteConfig['customColors']>
  textColor: string
  accentColor: string
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9A-Fa-f]{6})$/.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** Relative luminance (0–1); used to pick light vs dark text on page background. */
function hexLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0.5
  const toLin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * toLin(rgb.r) + 0.7152 * toLin(rgb.g) + 0.0722 * toLin(rgb.b)
}

function isDarkHex(hex: string): boolean {
  return hexLuminance(hex) < 0.45
}

/** Pull a representative hex from a CSS gradient for contrast checks. */
function representativeColorFromGradient(gradient: string): string {
  const hexMatch = gradient.match(/#([0-9A-Fa-f]{6})/)
  if (hexMatch) return `#${hexMatch[1]}`
  const rgbMatch = gradient.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/)
  if (rgbMatch) {
    return rgbToHex(`rgb(${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]})`)
  }
  return FALLBACK_BG
}

async function deriveStarterPalette(context: SelectedDesignContext | null): Promise<StarterPalette> {
  const bgGradient = context?.bgGradient?.trim()
  const bgUrl = context?.bgUrl?.trim()

  if (bgGradient) {
    const rep = representativeColorFromGradient(bgGradient)
    const dark = isDarkHex(rep)
    return {
      customColors: { backgroundGradient: bgGradient },
      textColor: dark ? '#FFFFFF' : FALLBACK_TEXT,
      accentColor: dark ? '#E8D8C3' : FALLBACK_ACCENT,
    }
  }

  if (bgUrl) {
    try {
      const colors = await extractDominantColors(bgUrl, 2)
      const primary = rgbToHex(colors[0] ?? 'rgb(232,216,195)')
      const accent = colors[1] ? rgbToHex(colors[1]) : FALLBACK_ACCENT
      const dark = isDarkHex(primary)
      return {
        customColors: { backgroundColor: primary },
        textColor: dark ? '#FFFFFF' : FALLBACK_TEXT,
        accentColor: accent,
      }
    } catch {
      /* fall through */
    }
  }

  return {
    customColors: { backgroundColor: FALLBACK_BG },
    textColor: FALLBACK_TEXT,
    accentColor: FALLBACK_ACCENT,
  }
}

function tileId(type: TileType, suffix: string): string {
  return `starter-${type}-${suffix}`
}

function buildTitleTile(
  order: number,
  palette: StarterPalette,
  opts?: { size?: 'small' | 'medium' | 'large' | 'xlarge' },
): Tile {
  return {
    id: tileId('title', 'main'),
    type: 'title',
    enabled: true,
    order,
    settings: {
      text: STARTER_TITLE,
      subtitle: STARTER_SUBTITLE,
      font: TITLE_FONT,
      color: palette.textColor,
      size: opts?.size ?? 'large',
      subtitleFont: BODY_FONT,
      subtitleColor: palette.textColor,
      subtitleSize: 'medium',
    },
  }
}

function buildDesignTile(
  order: number,
  cardSrc?: string,
  bgGradient?: string,
  textOverlays?: SelectedDesignContext['textOverlays'],
): Tile {
  return {
    id: tileId('design', 'main'),
    type: 'design',
    enabled: true,
    order,
    settings: {
      src: cardSrc || undefined,
      backgroundGradient: cardSrc ? undefined : bgGradient || undefined,
      imageFit: 'contain',
      textOverlays: textOverlays?.length ? textOverlays : [],
    },
  }
}

function buildEventDetailsTile(order: number, palette: StarterPalette): Tile {
  return {
    id: tileId('event-details', 'main'),
    type: 'event-details',
    enabled: true,
    order,
    settings: {
      location: '',
      date: '',
      fontColor: palette.textColor,
      buttonColor: palette.accentColor,
      borderStyle: 'elegant',
    },
  }
}

function buildFeatureButtonsTile(order: number, palette: StarterPalette): Tile {
  return {
    id: tileId('feature-buttons', 'main'),
    type: 'feature-buttons',
    enabled: true,
    order,
    settings: {
      buttonColor: palette.accentColor,
    },
  }
}

type StarterArchetype = {
  id: string
  name: string
  description: string
  tileSequence: TileType[]
  titleSize?: 'small' | 'medium' | 'large' | 'xlarge'
}

const ARCHETYPES: StarterArchetype[] = [
  {
    id: 'starter-card-then-title',
    name: 'Card first',
    description: 'Your design at the top, then a headline and event details.',
    tileSequence: ['design', 'title', 'event-details', 'feature-buttons'],
  },
  {
    id: 'starter-title-then-card',
    name: 'Title first',
    description: 'Headline leads, then your design and event details.',
    tileSequence: ['title', 'design', 'event-details', 'feature-buttons'],
  },
  {
    id: 'starter-card-banner',
    name: 'Card + title below',
    description: 'Design hero with a compact title band underneath.',
    tileSequence: ['design', 'title', 'event-details', 'feature-buttons'],
    titleSize: 'medium',
  },
]

function buildConfigForArchetype(
  archetype: StarterArchetype,
  palette: StarterPalette,
  context: SelectedDesignContext | null,
): InviteConfig {
  const cardSrc = context?.bgUrl?.trim() || undefined
  const bgGradient = context?.bgGradient?.trim() || undefined
  const tiles: Tile[] = []
  let order = 0
  for (const tileType of archetype.tileSequence) {
    if (tileType === 'design') {
      tiles.push(buildDesignTile(order, cardSrc, bgGradient, context?.textOverlays))
    } else if (tileType === 'title') {
      tiles.push(buildTitleTile(order, palette, { size: archetype.titleSize }))
    } else if (tileType === 'event-details') {
      tiles.push(buildEventDetailsTile(order, palette))
    } else if (tileType === 'feature-buttons') {
      tiles.push(buildFeatureButtonsTile(order, palette))
    }
    order += 1
  }

  return {
    themeId: 'minimal-ivory',
    tileSetComplete: true,
    customColors: palette.customColors,
    tiles,
  }
}

/**
 * Build three mechanical starter layouts tinted to the host's selected background.
 */
export async function buildStarterLayouts(
  context: SelectedDesignContext | null,
): Promise<InvitePageLayout[]> {
  const palette = await deriveStarterPalette(context)
  const cardSrc = context?.bgUrl?.trim() || undefined

  return ARCHETYPES.map((archetype) => ({
    id: archetype.id,
    name: archetype.name,
    description: archetype.description,
    thumbnail: cardSrc || '/invite-templates/minimal.svg',
    previewAlt: `${archetype.name} starter layout`,
    config: buildConfigForArchetype(archetype, palette, context),
    isStarter: true,
  }))
}
