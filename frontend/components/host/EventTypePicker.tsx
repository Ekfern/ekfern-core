'use client'

import React, { useState } from 'react'
import { Check, Search } from 'lucide-react'
import EventTypeSelect from '@/components/ui/EventTypeSelect'
import { getEventTypeLabel, type EventTypeValue } from '@/lib/eventTypes'

/**
 * What most hosts pick, one tap each. Everything else is a search away: 58
 * types are too many for chips and too many to scroll.
 */
export const QUICK_EVENT_TYPES: EventTypeValue[] = ['wedding', 'birthday', 'engagement', 'puja', 'housewarming']

interface EventTypePickerProps {
  value: string
  onChange: (value: EventTypeValue | '') => void
  hasError?: boolean
  labelledBy?: string
}

export default function EventTypePicker({ value, onChange, hasError = false, labelledBy }: EventTypePickerProps) {
  const [searching, setSearching] = useState(false)
  const pickedFromSearch = !!value && !QUICK_EVENT_TYPES.includes(value as EventTypeValue)

  const chip = (selected: boolean) =>
    `inline-flex h-11 items-center gap-2 rounded-full border-2 px-4 text-sm transition-colors ${
      selected
        ? 'border-eco-green bg-eco-green font-semibold text-white'
        : `bg-white font-medium text-eco-green hover:bg-eco-beige/40 ${hasError ? 'border-red-400' : 'border-eco-green-light'}`
    }`

  return (
    <div className="space-y-2">
      <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
        {QUICK_EVENT_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={value === type}
            onClick={() => {
              onChange(type)
              setSearching(false)
            }}
            className={chip(value === type)}
          >
            {getEventTypeLabel(type)}
          </button>
        ))}
        {pickedFromSearch && (
          <button type="button" aria-pressed="true" onClick={() => setSearching((s) => !s)} className={chip(true)}>
            <Check className="h-4 w-4" aria-hidden="true" />
            {getEventTypeLabel(value)}
          </button>
        )}
        <button
          type="button"
          aria-expanded={searching}
          onClick={() => setSearching((s) => !s)}
          className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-dashed border-eco-green-light bg-white px-4 text-sm font-medium text-eco-green hover:bg-eco-beige/40"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Something else…
        </button>
      </div>
      {searching && (
        <EventTypeSelect
          value={value}
          defaultOpen
          placeholder="Search: satsang, offsite, baby shower…"
          onChange={(next) => {
            onChange(next)
            if (next) setSearching(false)
          }}
        />
      )}
    </div>
  )
}
