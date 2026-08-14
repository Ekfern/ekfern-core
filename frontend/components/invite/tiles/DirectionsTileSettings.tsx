'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import type { DirectionsTileSettings } from '@/lib/invite/schema'
import dynamic from 'next/dynamic'
import { searchPlaces, type PlaceSuggestion } from '@/lib/invite/places'

// Editor-only, and only once a pin exists: Leaflet never reaches a guest's
// invitation, and never loads for a host who has not set a location.
const DirectionsMapPicker = dynamic(() => import('./DirectionsMapPicker'), { ssr: false })

/**
 * What the last lookup concluded. Coordinates are offered as an answer to a
 * search that came back empty - not as permanent furniture beside a field that
 * usually works.
 */
type LookupState = 'idle' | 'searching' | 'found' | 'no-match' | 'unavailable'

/** Long enough that a host stops typing, short enough to feel immediate. */
const SUGGEST_DEBOUNCE_MS = 300

const LAT_RANGE = 90
const LNG_RANGE = 180

/** Parse a typed coordinate, rejecting blanks, junk and out-of-range values. */
function parseCoordinate(value: string, limit: number): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || Math.abs(parsed) > limit) return null
  return parsed
}

interface DirectionsTileSettingsProps {
  settings: DirectionsTileSettings
  onChange: (settings: DirectionsTileSettings) => void
}

/**
 * Deliberately short.
 *
 * The map's settings lived among 23 others inside Event Details, which is how a
 * host who typed a venue name never noticed the map existed. Here the address
 * is the first and only required thing, and everything else has a sensible
 * default.
 */
export default function DirectionsTileSettings({ settings, onChange }: DirectionsTileSettingsProps) {
  // A page can hold several Directions tiles, and more than one can be open at
  // once. Fixed ids would collide across them, pointing every label at the first
  // tile's inputs.
  const uid = useId()
  const fieldId = (name: string) => `directions-${name}-${uid}`

  const update = (patch: Partial<DirectionsTileSettings>) => onChange({ ...settings, ...patch })

  // Held as text while typing: a half-entered "-" or "28." is not a number yet,
  // and re-deriving the field from the parsed value would fight the host's
  // keystrokes.
  const [latText, setLatText] = useState(() => settings.coordinates?.lat?.toString() ?? '')
  const [lngText, setLngText] = useState(() => settings.coordinates?.lng?.toString() ?? '')

  // Follow changes that came from elsewhere (a layout applied, a template, undo).
  useEffect(() => {
    setLatText(settings.coordinates?.lat?.toString() ?? '')
    setLngText(settings.coordinates?.lng?.toString() ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.coordinates?.lat, settings.coordinates?.lng])

  const commitCoordinates = (nextLat: string, nextLng: string) => {
    const lat = parseCoordinate(nextLat, LAT_RANGE)
    const lng = parseCoordinate(nextLng, LNG_RANGE)
    if (lat !== null && lng !== null) {
      update({ coordinates: { lat, lng } })
    } else if (!nextLat.trim() && !nextLng.trim()) {
      update({ coordinates: undefined })
    }
    // A half-filled or invalid pair is left alone until it becomes usable.
  }

  // --- address suggestions -------------------------------------------------
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [attribution, setAttribution] = useState('')
  const [highlighted, setHighlighted] = useState(-1)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [lookupState, setLookupState] = useState<LookupState>('idle')
  // Set while a suggestion is being applied, so the resulting value change does
  // not immediately search for what the host just picked.
  const justPicked = useRef(false)

  useEffect(() => {
    const query = settings.mapUrl || ''
    if (justPicked.current) {
      justPicked.current = false
      return
    }
    // A pasted link is already a destination; there is nothing to suggest.
    if (/^https?:\/\//i.test(query.trim()) || query.trim().length < 3) {
      setSuggestions([])
      setLookupState('idle')
      return
    }

    const controller = new AbortController()
    setLookupState('searching')
    const timer = setTimeout(async () => {
      const { results, attribution: credit, status } = await searchPlaces(query, controller.signal)
      setSuggestions(results)
      setAttribution(credit)
      setHighlighted(-1)
      setSuggestOpen(results.length > 0)
      setLookupState(
        status === 'unavailable' ? 'unavailable' : results.length > 0 ? 'found' : 'no-match',
      )
    }, SUGGEST_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [settings.mapUrl])

  const applySuggestion = (suggestion: PlaceSuggestion) => {
    justPicked.current = true
    setLatText(suggestion.lat.toString())
    setLngText(suggestion.lng.toString())
    // Both halves of the address story at once: the words a guest reads and the
    // point the map pins. Manual entry writes the same two fields.
    onChange({
      ...settings,
      mapUrl: suggestion.label,
      coordinates: { lat: suggestion.lat, lng: suggestion.lng },
    })
    setSuggestions([])
    setSuggestOpen(false)
    setHighlighted(-1)
    setLookupState('found')
  }

  const onAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestOpen || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault()
      applySuggestion(suggestions[highlighted])
    } else if (e.key === 'Escape') {
      setSuggestOpen(false)
    }
  }

  const bothBlank = !latText.trim() && !lngText.trim()
  const latValid = parseCoordinate(latText, LAT_RANGE) !== null
  const lngValid = parseCoordinate(lngText, LNG_RANGE) !== null
  const coordinateError = bothBlank ? '' : !latValid || !lngValid
    ? 'Enter both, as decimals: latitude between -90 and 90, longitude between -180 and 180.'
    : ''
  const isPinned = !!settings.coordinates
  // An empty tile shows no map. The picker is there to confirm and adjust a
  // place the host has named - with nothing typed there is nothing to confirm,
  // and an empty map box just looks broken.
  const showMapPicker = isPinned && !!settings.mapUrl?.trim()
  // Offered when the search genuinely found nothing, when the lookup itself is
  // down (a host must not be stranded by someone else's outage), or when a pin
  // already exists - hiding that would make saved coordinates uneditable.
  const showCoordinates = isPinned || lookupState === 'no-match' || lookupState === 'unavailable'

  return (
    <div className="space-y-4">
      <div className="relative">
        <label htmlFor={fieldId('address')} className="block text-sm font-medium">
          Address or map link *
        </label>
        <input
          id={fieldId('address')}
          type="text"
          role="combobox"
          aria-expanded={suggestOpen}
          aria-controls={fieldId('suggestions')}
          aria-autocomplete="list"
          autoComplete="off"
          value={settings.mapUrl || ''}
          onChange={(e) => update({ mapUrl: e.target.value })}
          onKeyDown={onAddressKeyDown}
          onFocus={() => setSuggestOpen(suggestions.length > 0)}
          onBlur={() => window.setTimeout(() => setSuggestOpen(false), 150)}
          placeholder="Start typing an address or venue"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />

        {suggestOpen && suggestions.length > 0 && (
          <ul
            id={fieldId('suggestions')}
            role="listbox"
            className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
          >
            {suggestions.map((suggestion, index) => (
              <li key={`${suggestion.lat},${suggestion.lng},${suggestion.label}`} role="option" aria-selected={index === highlighted}>
                <button
                  type="button"
                  // onMouseDown, not onClick: blur fires first and would close
                  // the list before a click ever landed.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    applySuggestion(suggestion)
                  }}
                  onMouseEnter={() => setHighlighted(index)}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    index === highlighted ? 'bg-gray-100' : 'bg-white'
                  }`}
                >
                  {suggestion.label}
                </button>
              </li>
            ))}
            {attribution && (
              <li className="border-t border-gray-100 px-3 py-1.5 text-[11px] text-gray-400">
                {attribution}
              </li>
            )}
          </ul>
        )}

        <p className="mt-1 text-xs text-gray-500">
          Pick a suggestion to pin the exact spot, or paste a map link. Guests tap
          the map to open directions in their own map app.
        </p>
      </div>

      {/* Coordinates: the way in for places an address lookup does not know -
          a farm, a new venue, a private address - and the exact pin for anywhere
          else. Both the map and the tap-through link prefer these over text. */}
      {showMapPicker && (
        <DirectionsMapPicker
          lat={settings.coordinates!.lat}
          lng={settings.coordinates!.lng}
          zoom={settings.zoom ?? 16}
          onMove={(lat, lng) => {
            setLatText(lat.toString())
            setLngText(lng.toString())
            update({ coordinates: { lat, lng } })
          }}
        />
      )}

      {showCoordinates && (
      <div className="rounded-md border border-gray-200 p-3">
        <p className="text-sm font-medium">
          {lookupState === 'unavailable'
            ? 'Address lookup is unavailable right now'
            : lookupState === 'no-match'
            ? "We couldn't find that address"
            : 'Pinned location'}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          {lookupState === 'unavailable'
            ? 'You can still pin the exact spot with coordinates.'
            : lookupState === 'no-match'
            ? 'Pin the exact spot with coordinates instead. Right-click the place in Google Maps to copy them.'
            : 'Set by the map above. Type them in if you already know the exact numbers.'}
        </p>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={fieldId('lat')} className="block text-xs font-medium text-gray-600">
              Latitude
            </label>
            <input
              id={fieldId('lat')}
              type="text"
              inputMode="decimal"
              value={latText}
              onChange={(e) => {
                setLatText(e.target.value)
                commitCoordinates(e.target.value, lngText)
              }}
              placeholder="28.0547"
              aria-invalid={!!coordinateError}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor={fieldId('lng')} className="block text-xs font-medium text-gray-600">
              Longitude
            </label>
            <input
              id={fieldId('lng')}
              type="text"
              inputMode="decimal"
              value={lngText}
              onChange={(e) => {
                setLngText(e.target.value)
                commitCoordinates(latText, e.target.value)
              }}
              placeholder="-82.3721"
              aria-invalid={!!coordinateError}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {coordinateError && (
          <p role="alert" className="mt-2 text-xs text-red-600">
            {coordinateError}
          </p>
        )}

        {isPinned && !coordinateError && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-green-700">
              Pinned at {settings.coordinates!.lat}, {settings.coordinates!.lng}
            </p>
            <button
              type="button"
              onClick={() => {
                setLatText('')
                setLngText('')
                update({ coordinates: undefined })
              }}
              className="text-xs font-medium text-gray-600 underline"
            >
              Clear pin
            </button>
          </div>
        )}
      </div>
      )}

      <div>
        <label htmlFor={fieldId('heading')} className="block text-sm font-medium">
          Heading
        </label>
        <input
          id={fieldId('heading')}
          type="text"
          value={settings.heading ?? ''}
          onChange={(e) => update({ heading: e.target.value })}
          placeholder="Getting there"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor={fieldId('address-line')} className="block text-sm font-medium">
          Address shown under the map
        </label>
        <input
          id={fieldId('address-line')}
          type="text"
          value={settings.addressLine ?? ''}
          onChange={(e) => update({ addressLine: e.target.value })}
          placeholder="Uses the address above"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <details className="rounded-md border border-gray-200 p-3">
        <summary className="cursor-pointer text-sm font-medium">Appearance</summary>
        <div className="mt-3 space-y-4">
          <div>
            <label htmlFor={fieldId('height')} className="block text-sm font-medium">
              Map height
            </label>
            <input
              id={fieldId('height')}
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
            <label htmlFor={fieldId('zoom')} className="block text-sm font-medium">
              Zoom
            </label>
            <input
              id={fieldId('zoom')}
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
            <label htmlFor={fieldId('align')} className="block text-sm font-medium">
              Alignment
            </label>
            <select
              id={fieldId('align')}
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
