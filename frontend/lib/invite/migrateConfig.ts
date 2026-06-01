/**
 * Migration utility to convert legacy InviteConfig to tile-based structure
 */

import { InviteConfig, Tile, TitleTileSettings, ImageTileSettings, TimerTileSettings, EventDetailsTileSettings, DescriptionTileSettings, FeatureButtonsTileSettings, FooterTileSettings } from './schema'

export function migrateToTileConfig(config: InviteConfig, eventTitle?: string, eventDate?: string, eventCity?: string): InviteConfig {
  // If config is null or undefined, return default
  if (!config) {
    return {
      themeId: 'classic-noir',
      tiles: [],
    }
  }

  // If tiles already exist, return as-is (after normalizing legacy tile types).
  if (config.tiles && config.tiles.length > 0) {
    // Legacy rename: the 'greeting-card' tile type was renamed to 'design'
    // (commit 043ed3b). Older saved configs and AI-generated layouts may still
    // carry the old type, which has no renderer or label on the frontend, so it
    // would show up as a blank tile. Normalize it on load as a safety net (a
    // data migration handles guest SSR, which does not run this).
    if (config.tiles.some((t) => (t as any).type === 'greeting-card')) {
      return {
        ...config,
        tiles: config.tiles.map((t) =>
          (t as any).type === 'greeting-card' ? { ...t, type: 'design' as const } : t,
        ),
      }
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

  // Image Tile (Optional)
  if (config.hero?.background && typeof config.hero.background === 'object' && 'src' in config.hero.background) {
    const bg = config.hero.background as any
    const imageSettings: ImageTileSettings = {
      src: bg.src,
      fitMode: bg.fitMode === 'cover' ? 'full-image' : bg.fitMode === 'contain' ? 'fit-to-screen' : 'fit-to-screen',
      backgroundColor: bg.backgroundColor || config.customColors?.backgroundColor,
      blur: bg.blur,
    }
    tiles.push({
      id: `tile-${order}`,
      type: 'image',
      enabled: true,
      order: order++,
      settings: imageSettings,
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

