import type { TextureType } from './schema'

/**
 * How maps look, in one place.
 *
 * The editor's picker and the invitation's map are separate components for good
 * reasons - one is interactive, one is six images - but they must render the
 * same map, or a host styles one thing and publishes another. Both read their
 * tiles and their treatment from here, so the two cannot drift.
 *
 * Every style below is achieved with a CSS filter over the tiles we already
 * load, plus one of the invite's own CSS-generated textures. Nothing here
 * downloads anything: the vintage look costs zero bytes.
 */

/**
 * The tile source. OpenStreetMap's Standard rendering needs no key.
 *
 * Swapping in a styled basemap - Carto Positron, Stadia, MapTiler, or Stamen
 * Watercolor for a genuinely painted look - is this line plus its attribution.
 */
export const MAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const MAP_ATTRIBUTION = '© OpenStreetMap'

export type MapStyle = 'standard' | 'vintage' | 'muted'

export interface MapStyleDefinition {
  label: string
  description: string
  /** Applied to the tiles alone, never to the pin - it should stay legible. */
  filter?: string
  texture?: TextureType
  textureIntensity?: number
  /** Darkens and warms towards the edges, the way old paper ages inwards. */
  vignette?: string
  /** Eats the straight edge away, so the map sits on paper rather than in a box. */
  tornEdges?: boolean
}

/**
 * A deckled paper edge, as a mask.
 *
 * A hand-authored irregular outline rather than an SVG turbulence filter: a
 * filtered mask renders inconsistently across browsers, and this needs to look
 * the same everywhere. The jitter is baked in, so every invitation gets the
 * same torn edge rather than a different one per render.
 *
 * Applied to the tile layer only, never the container, so the pin, the
 * attribution and the picker's drag handling stay outside it.
 */
export const MAP_EDGE_MASK =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' preserveAspectRatio='none'><path d='M10,9 L27,11 L45,16 L62,10 L79,10 L96,11 L114,6 L131,10 L148,12 L165,14 L183,4 L200,7 L217,4 L235,14 L252,13 L269,4 L286,17 L304,17 L321,12 L338,12 L355,5 L373,3 L390,10 L384,23 L386,35 L386,48 L383,61 L389,74 L389,86 L395,99 L390,112 L392,125 L390,137 L392,150 L389,163 L387,175 L397,188 L397,201 L395,214 L393,226 L387,239 L386,252 L387,265 L384,277 L390,294 L373,289 L355,295 L338,288 L321,296 L304,295 L286,283 L269,286 L252,296 L235,290 L217,297 L200,289 L183,284 L165,292 L148,294 L131,287 L114,284 L96,288 L79,296 L62,294 L45,285 L27,286 L4,290 L4,277 L14,265 L5,252 L11,239 L9,226 L6,214 L13,201 L5,188 L12,175 L5,163 L9,150 L6,137 L7,125 L17,112 L14,99 L7,86 L15,74 L6,61 L9,48 L15,35 L12,23 Z' fill='white'/></svg>\")"

export const MAP_STYLES: Record<MapStyle, MapStyleDefinition> = {
  standard: {
    label: 'Standard',
    description: 'The map as it comes',
  },
  vintage: {
    label: 'Vintage paper',
    description: 'Antique chart — brown parchment, dark ink, worn edges',
    // Two earlier attempts failed in opposite directions: desaturating washed
    // the roads away, then saturating sepia turned green parks lurid yellow.
    // Both came from tinting colours that were still there. Grayscale first
    // flattens parks, water and roads to ink, contrast makes that ink read at
    // a glance, and a single multiply tint does the ageing - so the parchment
    // colour is chosen outright rather than emerging from a filter chain.
    // Order matters. Grayscale first flattens parks, water and roads to ink -
    // the earlier attempts went lurid because sepia was tinting colours that
    // were still there. Contrast makes that ink read at a glance, and only
    // then does sepia age it, uniformly, because there is nothing left to
    // clash. A multiply layer was tried instead and did not survive the
    // filtered stacking context.
    filter:
      'grayscale(1) contrast(1.6) brightness(0.86) sepia(0.95) saturate(1.35) hue-rotate(-18deg)',
    texture: 'vintage-paper',
    textureIntensity: 45,
    // Warm shadow gathering at the edges, as paper darkens with handling.
    vignette:
      'radial-gradient(115% 95% at 50% 45%, rgba(120,72,28,0) 28%, rgba(96,55,20,0.42) 72%, rgba(58,31,9,0.72) 100%)',
    tornEdges: true,
  },
  muted: {
    label: 'Muted',
    description: 'Quiet, so the map does not compete with the invitation',
    filter: 'saturate(0.45) brightness(1.04) contrast(0.98)',
  },
}

export function getMapStyle(style?: MapStyle | null): MapStyleDefinition {
  return MAP_STYLES[style ?? 'standard'] ?? MAP_STYLES.standard
}
