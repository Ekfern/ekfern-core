import React from 'react'

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
 * The one place a map style is chosen. OpenStreetMap's Standard rendering needs
 * no key; swapping in Carto Positron, Stadia or MapTiler for a look that suits
 * the invitation is a change to this line plus their attribution.
 */
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = '© OpenStreetMap'

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
  /** Described to screen readers, since the map itself is decorative. */
  label?: string
}

export default function StaticTileMap({
  lat,
  lng,
  zoom = 16,
  height = 260,
  label,
}: StaticTileMapProps) {
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
          src={TILE_URL.replace('{z}', String(zoom))
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
      className="relative w-full overflow-hidden rounded-xl bg-gray-100"
      style={{ height }}
      role="img"
      aria-label={label ? `Map showing ${label}` : 'Map showing the event location'}
    >
      {/* The tile grid is centred on the venue and clipped by the container. */}
      <div
        className="absolute left-1/2 top-0"
        style={{ width, height, transform: 'translateX(-50%)' }}
      >
        {tiles}
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
        {TILE_ATTRIBUTION}
      </span>
    </div>
  )
}
