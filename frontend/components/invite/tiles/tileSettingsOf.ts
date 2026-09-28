import type { Tile } from '@/lib/invite/schema'

/**
 * A tile's settings, guaranteed to be an object.
 *
 * Every settings panel reads `settings.<field>` directly, so a tile whose
 * settings are missing crashed the entire page editor rather than showing an
 * empty form. Configs legitimately arrive that way — a partial write, an
 * import, or a template that never set them — so the guarantee belongs here,
 * once, rather than in each panel.
 */
export function tileSettingsOf(tile: Pick<Tile, 'settings'> | null | undefined): Record<string, unknown> {
  const settings = tile?.settings
  return settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : {}
}
