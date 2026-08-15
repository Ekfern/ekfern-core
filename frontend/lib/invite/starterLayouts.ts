/**
 * Pure mechanical starter page layouts for hosts when the layout catalog is
 * empty. Client-only — not persisted. Rendered with the neutral fallback
 * palette; the host picks colors/background afterward in the Design step.
 */

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

const NEUTRAL_PALETTE: StarterPalette = {
  customColors: { backgroundColor: FALLBACK_BG },
  textColor: FALLBACK_TEXT,
  accentColor: FALLBACK_ACCENT,
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

function buildPosterTile(order: number): Tile {
  return {
    id: tileId('poster', 'main'),
    type: 'poster',
    enabled: true,
    order,
    settings: {
      imageFit: 'contain',
      textOverlays: [],
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
    tileSequence: ['poster', 'title', 'event-details', 'feature-buttons'],
  },
  {
    id: 'starter-title-then-card',
    name: 'Title first',
    description: 'Headline leads, then your design and event details.',
    tileSequence: ['title', 'poster', 'event-details', 'feature-buttons'],
  },
  {
    id: 'starter-card-banner',
    name: 'Card + title below',
    description: 'Design hero with a compact title band underneath.',
    tileSequence: ['poster', 'title', 'event-details', 'feature-buttons'],
    titleSize: 'medium',
  },
]

function buildConfigForArchetype(archetype: StarterArchetype, palette: StarterPalette): InviteConfig {
  const tiles: Tile[] = []
  let order = 0
  for (const tileType of archetype.tileSequence) {
    if (tileType === 'poster') {
      tiles.push(buildPosterTile(order))
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
    tileSetComplete: true,
    customColors: palette.customColors,
    tiles,
  }
}

/**
 * Build three mechanical starter layouts, shown only when the layout catalog
 * has nothing else to offer. Rendered with a neutral palette — colors come
 * from the Design step afterward.
 */
export async function buildStarterLayouts(): Promise<InvitePageLayout[]> {
  return ARCHETYPES.map((archetype) => ({
    id: archetype.id,
    name: archetype.name,
    description: archetype.description,
    thumbnail: '/invite-templates/minimal.svg',
    previewAlt: `${archetype.name} starter layout`,
    config: buildConfigForArchetype(archetype, NEUTRAL_PALETTE),
    isStarter: true,
  }))
}
