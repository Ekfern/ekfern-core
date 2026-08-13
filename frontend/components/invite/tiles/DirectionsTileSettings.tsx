'use client'

import React from 'react'
import type { DirectionsTileSettings } from '@/lib/invite/schema'

interface DirectionsTileSettingsProps {
  settings: DirectionsTileSettings
  onChange: (settings: DirectionsTileSettings) => void
  /** Shown as the placeholder for the address line, so the fallback is visible. */
  eventLocation?: string
}

/**
 * Deliberately short.
 *
 * The map's settings lived among 23 others inside Event Details, which is how a
 * host who typed a venue name never noticed the map existed. Here the address
 * is the first and only required thing, and everything else has a sensible
 * default.
 */
export default function DirectionsTileSettings({
  settings,
  onChange,
  eventLocation,
}: DirectionsTileSettingsProps) {
  const update = (patch: Partial<DirectionsTileSettings>) => onChange({ ...settings, ...patch })

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="directions-address" className="block text-sm font-medium">
          Address or map link *
        </label>
        <input
          id="directions-address"
          type="text"
          value={settings.mapUrl || ''}
          onChange={(e) => update({ mapUrl: e.target.value })}
          placeholder="Enter address, or paste a Google Maps link"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Guests tap the map to open directions in their own map app.
        </p>
      </div>

      <div>
        <label htmlFor="directions-heading" className="block text-sm font-medium">
          Heading
        </label>
        <input
          id="directions-heading"
          type="text"
          value={settings.heading ?? ''}
          onChange={(e) => update({ heading: e.target.value })}
          placeholder="Getting there"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="directions-address-line" className="block text-sm font-medium">
          Address shown under the map
        </label>
        <input
          id="directions-address-line"
          type="text"
          value={settings.addressLine ?? ''}
          onChange={(e) => update({ addressLine: e.target.value })}
          placeholder={eventLocation || 'Uses your event location'}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <details className="rounded-md border border-gray-200 p-3">
        <summary className="cursor-pointer text-sm font-medium">Appearance</summary>
        <div className="mt-3 space-y-4">
          <div>
            <label htmlFor="directions-height" className="block text-sm font-medium">
              Map height
            </label>
            <input
              id="directions-height"
              type="range"
              min={160}
              max={420}
              step={20}
              value={settings.height ?? 260}
              onChange={(e) => update({ height: Number(e.target.value) })}
              className="mt-1 w-full"
            />
            <p className="text-xs text-gray-500">{settings.height ?? 260}px</p>
          </div>

          <div>
            <label htmlFor="directions-zoom" className="block text-sm font-medium">
              Zoom
            </label>
            <input
              id="directions-zoom"
              type="range"
              min={12}
              max={19}
              step={1}
              value={settings.zoom ?? 16}
              onChange={(e) => update({ zoom: Number(e.target.value) })}
              className="mt-1 w-full"
            />
            <p className="text-xs text-gray-500">
              {(settings.zoom ?? 16) <= 13 ? 'City' : (settings.zoom ?? 16) <= 16 ? 'Neighbourhood' : 'Street'}
            </p>
          </div>

          <div>
            <label htmlFor="directions-align" className="block text-sm font-medium">
              Alignment
            </label>
            <select
              id="directions-align"
              value={settings.textAlign ?? 'center'}
              onChange={(e) => update({ textAlign: e.target.value as DirectionsTileSettings['textAlign'] })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="center">Centred</option>
              <option value="left">Left</option>
            </select>
          </div>
        </div>
      </details>
    </div>
  )
}
