'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { Clock, MapPin, Search } from 'lucide-react'
import { searchCities, type CitySuggestion } from '@/lib/invite/places'
import { COUNTRY_CODES } from '@/lib/countryCodesFull'
import { allZones, countryZones, deviceTimeZone, timeZoneName, zoneChoices } from '@/lib/eventTimezone'

export type WhereMode = 'in-person' | 'online'

export interface WhereValue {
  city: string
  country: string
  timezone: string
}

interface WhereFieldProps {
  mode: WhereMode
  onModeChange: (mode: WhereMode) => void
  value: WhereValue
  onChange: (patch: Partial<WhereValue>) => void
}

/** Wait for a pause in typing; most searches finish well inside the next one. */
const DEBOUNCE_MS = 350
/** Only say "Searching…" when it is actually slow. */
const SLOW_MS = 800
/** One failed search changes nothing on screen; this many in a row brings in Country. */
const FAILURES_BEFORE_FALLBACK = 2

const COUNTRY_OPTIONS = Object.entries(COUNTRY_CODES).sort(([, a], [, b]) => a.name.localeCompare(b.name))

function countryName(code: string): string {
  return COUNTRY_CODES[code.toUpperCase()]?.name ?? code
}

/**
 * Where the event is, and from that its time zone.
 *
 * In person: type a town, pick it, and the city, country and time zone are set
 * together. When search is down or the town is not found, a Country dropdown
 * slides in under the same field - the typed town stays - and the zone comes
 * from the country, asking which only for countries with more than one.
 * Online: no town; the zone is the host's device's.
 *
 * Either way one line says which zone the times are in, with Change.
 */
export default function WhereField({ mode, onModeChange, value, onChange }: WhereFieldProps) {
  const uid = useId()
  const id = (name: string) => `where-${name}-${uid}`

  // A city arriving from the server (the edit page) shows as already picked.
  const [picked, setPicked] = useState<{ name: string; region: string } | null>(() =>
    value.city ? { name: value.city, region: countryName(value.country) } : null,
  )
  const [query, setQuery] = useState(value.city)
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([])
  const [attribution, setAttribution] = useState('')
  const [noMatch, setNoMatch] = useState(false)
  const [slow, setSlow] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [manual, setManual] = useState(false)
  const [serviceDown, setServiceDown] = useState(false)
  // Whatever the form starts with is the event's saved zone (or the create
  // page's default); "from your device" only once switching to online sets it.
  const [zoneSource, setZoneSource] = useState<'city' | 'country' | 'device' | 'chosen' | 'saved'>('saved')
  const [zonePickerOpen, setZonePickerOpen] = useState(false)
  const failures = useRef(0)

  // Search as the host types, after a pause; a newer keystroke cancels the old search.
  useEffect(() => {
    if (mode !== 'in-person' || picked || manual) return
    const q = query.trim()
    setNoMatch(false)
    if (q.length < 3) {
      setSuggestions([])
      return
    }
    const controller = new AbortController()
    let slowTimer: ReturnType<typeof setTimeout> | undefined
    const timer = setTimeout(async () => {
      slowTimer = setTimeout(() => setSlow(true), SLOW_MS)
      const result = await searchCities(q, controller.signal)
      clearTimeout(slowTimer)
      if (controller.signal.aborted) return
      setSlow(false)
      if (result.status === 'unavailable') {
        failures.current += 1
        if (failures.current >= FAILURES_BEFORE_FALLBACK) {
          setServiceDown(true)
          setManual(true)
          setZoneSource('country')
        }
        return
      }
      failures.current = 0
      setSuggestions(result.results)
      setAttribution(result.attribution)
      setNoMatch(result.results.length === 0)
      setListOpen(true)
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      clearTimeout(slowTimer)
      controller.abort()
    }
  }, [query, mode, picked, manual])

  // Typing a country by hand: its zone, or the first of several until the host picks.
  useEffect(() => {
    if (!manual || mode !== 'in-person' || zoneSource === 'chosen') return
    const zones = countryZones(value.country)
    if (zones.length && !zones.includes(value.timezone)) onChange({ timezone: zones[0] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual, mode, value.country])

  const pick = (city: CitySuggestion) => {
    const timezone = city.timezone || countryZones(city.country_code)[0] || value.timezone
    setPicked({ name: city.name, region: city.region })
    setListOpen(false)
    setSuggestions([])
    setZoneSource(city.timezone ? 'city' : 'country')
    setZonePickerOpen(false)
    onChange({ city: city.name, country: city.country_code || value.country, timezone })
  }

  const changeCity = () => {
    setPicked(null)
    setQuery(value.city)
    setZonePickerOpen(false)
  }

  const typeItIn = () => {
    setManual(true)
    setListOpen(false)
    setZoneSource('country')
    onChange({ city: query.trim() })
  }

  const searchAgain = () => {
    failures.current = 0
    setServiceDown(false)
    setManual(false)
    setPicked(null)
    setQuery(value.city)
  }

  const switchMode = (next: WhereMode) => {
    if (next === mode) return
    onModeChange(next)
    setZonePickerOpen(false)
    if (next === 'online') {
      setZoneSource('device')
      onChange({ city: '', timezone: deviceTimeZone() })
    } else {
      setZoneSource('saved')
      setPicked(null)
      setQuery('')
    }
  }

  const zones = countryZones(value.country)
  const askWhichZone = mode === 'in-person' && manual && zones.length > 1
  const sourceNote =
    zoneSource === 'city' && picked ? `, from ${picked.name}` : zoneSource === 'device' ? ', from your device' : ''

  const segment = (active: boolean) =>
    `h-10 rounded-full px-5 text-sm transition-colors ${
      active ? 'bg-eco-green font-semibold text-white' : 'text-eco-green hover:bg-white/60'
    }`

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div id={id('label')} className="text-sm font-medium">Where</div>
      <div role="group" aria-labelledby={id('label')} className="inline-flex gap-1 rounded-full bg-eco-beige/60 p-1">
        <button type="button" aria-pressed={mode === 'in-person'} onClick={() => switchMode('in-person')} className={segment(mode === 'in-person')}>
          In person
        </button>
        <button type="button" aria-pressed={mode === 'online'} onClick={() => switchMode('online')} className={segment(mode === 'online')}>
          Online
        </button>
      </div>
      </div>

      {mode === 'in-person' && !manual && picked && (
        <div className="flex items-center gap-3 rounded-md border-2 border-eco-green bg-eco-beige/30 py-2 pl-3 pr-2">
          <MapPin className="h-5 w-5 shrink-0 text-eco-teal" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{picked.name}</div>
            {picked.region && <div className="truncate text-xs text-gray-600">{picked.region}</div>}
          </div>
          <button type="button" onClick={changeCity} className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium">
            Change
          </button>
        </div>
      )}

      {mode === 'in-person' && !manual && !picked && (
        <div
          className="relative space-y-1.5"
          // Close the list once focus leaves the field and its suggestions.
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setListOpen(false)
          }}
        >
          <label htmlFor={id('city')} className="block text-xs text-gray-600">
            City
          </label>
          <div className="flex h-10 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 focus-within:ring-2 focus-within:ring-eco-green">
            <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <input
              id={id('city')}
              role="combobox"
              aria-expanded={listOpen && suggestions.length > 0}
              aria-controls={id('list')}
              aria-autocomplete="list"
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                // What is typed counts, even if never picked: nothing to retype later.
                onChange({ city: e.target.value.trim() })
              }}
              onFocus={() => suggestions.length > 0 && setListOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setListOpen(false)
                if (e.key === 'Enter') e.preventDefault()
              }}
              placeholder="Start typing a town: Udaipur, London…"
              className="h-full flex-1 bg-transparent text-sm outline-none"
            />
            {slow && <span className="text-xs text-gray-500">Searching…</span>}
          </div>

          {listOpen && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
              <ul id={id('list')} role="listbox" aria-label="Matching towns">
                {suggestions.map((city) => (
                  <li key={`${city.label}-${city.lat}`} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onClick={() => pick(city)}
                      className="flex w-full items-center gap-3 border-b border-gray-100 px-3 py-2.5 text-left hover:bg-eco-beige/30 focus:bg-eco-beige/30 focus:outline-none"
                    >
                      <MapPin className="h-4 w-4 shrink-0 text-eco-teal" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{city.name}</span>
                        {city.region && <span className="block truncate text-xs text-gray-600">{city.region}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {attribution && <div className="bg-gray-50 px-3 py-1.5 text-[11px] text-gray-500">{attribution}</div>}
            </div>
          )}

          {noMatch && <p className="text-sm text-gray-600">No town matches “{query.trim()}”.</p>}
          <button type="button" onClick={typeItIn} className="text-sm font-medium text-eco-teal underline underline-offset-2">
            Can’t find your town? Type it in
          </button>
        </div>
      )}

      {mode === 'in-person' && manual && (
        <div className="space-y-3">
          {serviceDown && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Town search isn’t responding. Add your country and carry on.
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor={id('manual-city')} className="block text-xs text-gray-600">
                City
              </label>
              <input
                id={id('manual-city')}
                value={value.city}
                onChange={(e) => onChange({ city: e.target.value })}
                placeholder="Your town or city"
                className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={id('country')} className="block text-xs text-gray-600">
                Country
              </label>
              <select
                id={id('country')}
                value={value.country}
                onChange={(e) => {
                  setZoneSource('country')
                  onChange({ country: e.target.value })
                }}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
              >
                {COUNTRY_OPTIONS.map(([iso, info]) => (
                  <option key={iso} value={iso}>
                    {info.flag} {info.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {askWhichZone && (
            <div className="space-y-1.5">
              <label htmlFor={id('country-zone')} className="block text-xs text-gray-600">
                {countryName(value.country)} has more than one time zone. Which is yours?
              </label>
              <select
                id={id('country-zone')}
                value={value.timezone}
                onChange={(e) => {
                  setZoneSource('chosen')
                  onChange({ timezone: e.target.value })
                }}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm sm:max-w-sm"
              >
                {zoneChoices(zones).map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button type="button" onClick={searchAgain} className="text-sm font-medium text-eco-teal underline underline-offset-2">
            Search for your town instead
          </button>
        </div>
      )}

      {mode === 'online' && (
        <p className="rounded-md bg-eco-beige/40 px-3 py-2 text-sm text-gray-700">
          Guests join online. You can add the link to the invitation later.
        </p>
      )}

      {!askWhichZone && value.timezone && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-gray-700">
            <Clock className="h-4 w-4 text-gray-500" aria-hidden="true" />
            <span>
              Times in <strong className="text-eco-green">{timeZoneName(value.timezone)}</strong>
              {sourceNote} ·
            </span>
            <button
              type="button"
              aria-expanded={zonePickerOpen}
              onClick={() => setZonePickerOpen((open) => !open)}
              className="font-medium text-eco-teal underline underline-offset-2"
            >
              Change
            </button>
          </div>
          {zonePickerOpen && (
            <ZonePicker
              value={value.timezone}
              suggested={mode === 'in-person' ? zones : []}
              onPick={(zone) => {
                setZoneSource('chosen')
                setZonePickerOpen(false)
                onChange({ timezone: zone })
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

/** The country's zones first, when known, then every zone. */
function ZonePicker({ value, suggested, onPick }: { value: string; suggested: readonly string[]; onPick: (zone: string) => void }) {
  const uid = useId()
  const [everyZone] = useState(() => allZones())
  const first = zoneChoices(suggested)
  const rest = everyZone.filter((zone) => !suggested.includes(zone))
  return (
    <div>
      <label htmlFor={`zone-${uid}`} className="sr-only">
        Time zone
      </label>
      <select
        id={`zone-${uid}`}
        value={value}
        onChange={(e) => onPick(e.target.value)}
        className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm sm:max-w-sm"
      >
        {!everyZone.includes(value) && !suggested.includes(value) && <option value={value}>{value}</option>}
        {first.length > 0 && (
          <optgroup label="This country">
            {first.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="All time zones">
          {rest.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replace(/_/g, ' ')}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  )
}
