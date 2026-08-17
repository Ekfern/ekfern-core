import React from 'react'
import TextureOverlay from '../render/TextureOverlay'
import MapSharpenFilter from './MapSharpenFilter'
import { MAP_ATTRIBUTION, MAP_EDGE_MASK, MAP_TILE_URL, getMapStyle, type MapStyle } from '@/lib/invite/mapStyles'

/**
 * A map for a guest's invitation: map tiles as plain images, and nothing else.
 *
 * The invite used to embed Google Maps in an iframe, which loads an entire map
 * application - hundreds of kilobytes of script, third-party cookies - so that
 * a guest can look at a picture of a street. This renders the same view as a
 * handful of image requests, no JavaScript and no frame, and it uses the same
 * tiles as the editor's picker so the two surfaces finally look alike.
 *
 * Interaction is deliberately absent. Panning a map inside a scrolling
 * invitation is a trap on a phone; the whole thing is a link that hands the
 * destination to the guest's own map app instead.
 */

/** Web Mercator: the projection every tile scheme on the web agrees on. */
const TILE_SIZE = 256

/**
 * Three tiles wide covers 768px, which is wider than any phone and most of the
 * invite column; anything beyond the container is clipped. Fixed because
 * without JavaScript we cannot measure the container first.
 */
const COLUMNS = 3

const lngToTileX = (lng: number, zoom: number) => ((lng + 180) / 360) * 2 ** zoom

const latToTileY = (lat: number, zoom: number) => {
  const radians = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * 2 ** zoom
}

export interface StaticTileMapProps {
  lat: number
  lng: number
  zoom?: number
  height?: number
  style?: MapStyle
  /** Described to screen readers, since the map itself is decorative. */
  label?: string
}

export default function StaticTileMap({
  lat,
  lng,
  zoom = 16,
  height = 260,
  style,
  label,
}: StaticTileMapProps) {
  const treatment = getMapStyle(style)
  const width = COLUMNS * TILE_SIZE

  // Where the venue sits, in whole-world pixels at this zoom.
  const centerX = lngToTileX(lng, zoom) * TILE_SIZE
  const centerY = latToTileY(lat, zoom) * TILE_SIZE

  // The top-left corner of the visible window, in the same pixel space.
  const originX = centerX - width / 2
  const originY = centerY - height / 2

  const firstTileX = Math.floor(originX / TILE_SIZE)
  const firstTileY = Math.floor(originY / TILE_SIZE)
  // How far the first tile hangs off the top-left of the window.
  const offsetX = firstTileX * TILE_SIZE - originX
  const offsetY = firstTileY * TILE_SIZE - originY

  const rows = Math.ceil((height - offsetY) / TILE_SIZE)
  const maxTile = 2 ** zoom

  const tiles: React.ReactNode[] = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      const tileX = firstTileX + column
      const tileY = firstTileY + row
      // Off the top or bottom of the world: nothing to draw.
      if (tileY < 0 || tileY >= maxTile) continue
      // Wrap around the antimeridian rather than leaving a gap.
      const wrappedX = ((tileX % maxTile) + maxTile) % maxTile

      tiles.push(
        <img
          key={`${tileX}-${tileY}`}
          src={MAP_TILE_URL.replace('{z}', String(zoom))
            .replace('{x}', String(wrappedX))
            .replace('{y}', String(tileY))}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          width={TILE_SIZE}
          height={TILE_SIZE}
          style={{
            position: 'absolute',
            left: offsetX + column * TILE_SIZE,
            top: offsetY + row * TILE_SIZE,
            width: TILE_SIZE,
            height: TILE_SIZE,
            maxWidth: 'none',
          }}
        />,
      )
    }
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl"
      // Nothing behind a torn sheet: the invitation shows through where the
      // paper is gone.
      style={{ height, background: treatment.tornEdges ? 'transparent' : '#f3f4f6' }}
      role="img"
      aria-label={label ? `Map showing ${label}` : 'Map showing the event location'}
    >
      {treatment.sharpen && <MapSharpenFilter />}

      {/* Everything that makes up the sheet lives inside one masked layer, so
          the tear removes all of it at once. Vignette and texture used to sit
          outside the mask and painted across the torn-away area, which is why
          the edge read as a filter rather than as paper. */}
      <div
        className="absolute inset-0"
        // The shadow is applied to the parent of the masked layer on purpose:
        // drop-shadow follows the child's alpha, so it traces the ragged
        // outline instead of drawing a rectangle around it.
        style={
          treatment.tornEdges
            ? { filter: 'drop-shadow(0 1px 1px rgba(38,20,6,.55)) drop-shadow(0 6px 10px rgba(38,20,6,.35))' }
            : undefined
        }
      >
        <div
          className="absolute left-1/2 top-0"
          style={{
            width,
            height,
            transform: 'translateX(-50%)',
            ...(treatment.tornEdges
              ? {
                  maskImage: MAP_EDGE_MASK,
                  WebkitMaskImage: MAP_EDGE_MASK,
                  maskSize: '100% 100%',
                  WebkitMaskSize: '100% 100%',
                  maskRepeat: 'no-repeat',
                  WebkitMaskRepeat: 'no-repeat',
                }
              : null),
          }}
        >
          {/* The colour treatment stays on the tiles alone, so the scorching
              and the paper above it are not run through it a second time. */}
          <div className="absolute inset-0" style={{ filter: treatment.filter }}>
            {tiles}
          </div>

          {treatment.vignette && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: treatment.vignette }}
              aria-hidden="true"
            />
          )}

          {treatment.scorch && (
            // Sun and fire, in that order inwards. Inside the mask, so the
            // whole gradient is clipped to the tear and follows every notch of
            // it rather than ringing a neat rectangle.
            <div
              className="pointer-events-none absolute inset-0"
              style={{ boxShadow: treatment.scorch }}
              aria-hidden="true"
            />
          )}

          {treatment.texture && (
            // The invitation's own paper, over the map, so it reads as printed
            // rather than pasted on. CSS-generated - no image is fetched.
            <div className="pointer-events-none absolute inset-0">
              <TextureOverlay type={treatment.texture} intensity={treatment.textureIntensity ?? 30} />
            </div>
          )}
        </div>
      </div>

      {/* The venue, at the exact centre - computed, not drawn by a map engine. */}
      <span
        aria-hidden="true"
        className="absolute"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -100%)',
          width: 22,
          height: 22,
        }}
      >
        <span
          className="block"
          style={{
            width: 22,
            height: 22,
            borderRadius: '50% 50% 50% 0',
            transform: 'rotate(-45deg)',
            background: '#0B3D2E',
            border: '3px solid #fff',
            boxShadow: '0 2px 6px rgba(0,0,0,.4)',
          }}
        />
      </span>

      {/* Required when showing OpenStreetMap tiles. */}
      <span className="absolute bottom-0 right-0 bg-white/70 px-1 text-[10px] leading-4 text-gray-700">
        {MAP_ATTRIBUTION}
      </span>
    </div>
  )
}
