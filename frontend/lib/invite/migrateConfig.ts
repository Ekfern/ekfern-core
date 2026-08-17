/**
 * Migration utility to convert legacy InviteConfig to tile-based structure
 */

import { InviteConfig, Tile, TitleTileSettings, GalleryTileSettings, TimerTileSettings, EventDetailsTileSettings, DescriptionTileSettings, FeatureButtonsTileSettings, FooterTileSettings } from './schema'

/**
 * Bring a tile up to the current type names and settings shape.
 *
 * Stored configs are migrated server-side; this is read-compat, so a config
 * loaded from anywhere - a cached payload, a fixture, an export - still
 * renders. Returns the tile unchanged when there is nothing legacy about it.
 *
 * Two renames are handled:
 *  - `greeting-card` -> `design` -> `poster`, the flyer with text overlays.
 *  - `image` -> `gallery`, which went from one `src` to a list of photos.
 */
const LEGACY_POSTER_TYPES = ['greeting-card', 'design']

function normalizeLegacyTile(tile: Tile): Tile {
  const type = (tile as any).type

  if (LEGACY_POSTER_TYPES.includes(type)) {
    return { ...tile, type: 'poster' } as Tile
  }

  if (type === 'image') {
    const legacy = (tile.settings ?? {}) as { src?: string }
    const settings: GalleryTileSettings = {
      images: legacy.src ? [{ id: `${tile.id}-1`, src: legacy.src }] : [],
      arrangement: 'vertical',
      frame: 'none',
    }
    return { ...tile, type: 'gallery', settings } as Tile
  }

  return tile
}

export function migrateToTileConfig(config: InviteConfig, eventTitle?: string, eventDate?: string, eventCity?: string): InviteConfig {
  // If config is null or undefined, return default
  if (!config) {
    return {
      tiles: [],
    }
  }

  // If tiles already exist, return as-is (after normalizing legacy tile types).
  if (config.tiles && config.tiles.length > 0) {
    const normalized = config.tiles.map(normalizeLegacyTile)
    if (normalized.some((tile, index) => tile !== config.tiles![index])) {
      return { ...config, tiles: normalized }
    }
    return config
  }

  const tiles: Tile[] = []
  let order = 0

  // Title Tile (Required)
  if (config.hero?.title || eventTitle) {
    const titleSettings: TitleTileSettings = {
      text: config.hero?.title || eventTitle || 'Event Title',
      font: config.customFonts?.titleFont,
      color: config.customColors?.fontColor,
    }
    tiles.push({
      id: `tile-${order}`,
      type: 'title',
      enabled: true,
      order: order++,
      settings: titleSettings,
    })
  }

  // Gallery Tile (Optional) - the legacy hero background becomes its one photo.
  if (config.hero?.background && typeof config.hero.background === 'object' && 'src' in config.hero.background) {
    const bg = config.hero.background as any
    const gallerySettings: GalleryTileSettings = {
      images: [{ id: `tile-${order}-1`, src: bg.src }],
      arrangement: 'vertical',
      frame: 'none',
    }
    tiles.push({
      id: `tile-${order}`,
      type: 'gallery',
      enabled: true,
      order: order++,
      settings: gallerySettings,
    })
  }

  // Timer Tile (Optional)
  if (config.hero?.showTimer && eventDate) {
    const timerSettings: TimerTileSettings = {
      enabled: true,
      format: 'circle',
    }
    tiles.push({
      id: `tile-${order}`,
      type: 'timer',
      enabled: true,
      order: order++,
      settings: timerSettings,
    })
  }

  // Event Details Tile (Required)
  const eventDetailsSettings: EventDetailsTileSettings = {
    location: eventCity || config.location?.name || config.location?.address || '',
    date: eventDate || config.hero?.eventDate || new Date().toISOString().split('T')[0],
    time: undefined,
    dressCode: undefined,
    buttonColor: config.customColors?.primaryColor || undefined,
  }
  tiles.push({
    id: `tile-${order}`,
    type: 'event-details',
    enabled: true,
    order: order++,
    settings: eventDetailsSettings,
  })

  // Description Tile (Optional)
  if (config.descriptionMarkdown) {
    const descriptionSettings: DescriptionTileSettings = {
      content: config.descriptionMarkdown,
    }
    tiles.push({
      id: `tile-${order}`,
      type: 'description',
      enabled: true,
      order: order++,
      settings: descriptionSettings,
    })
  }

  // Feature Buttons Tile
  const featureButtonsSettings: FeatureButtonsTileSettings = {
    buttonColor: config.customColors?.primaryColor,
  }
  tiles.push({
    id: `tile-${order}`,
    type: 'feature-buttons',
    enabled: true,
    order: order++,
    settings: featureButtonsSettings,
  })

  // Footer Tile (Optional, always at end)
  const footerSettings: FooterTileSettings = {
    text: '',
  }
  tiles.push({
    id: `tile-${order}`,
    type: 'footer',
    enabled: false,
    order: order++,
    settings: footerSettings,
  })

  return {
    ...config,
    tiles,
  }
}

