'use client'

import React, { useState } from 'react'
import type { EventDetailsTileSettings } from '@/lib/invite/schema'
import { colorInputValue } from '@/lib/invite/colorInputValue'
import { Input } from '@/components/ui/input'
import { FONT_OPTIONS, findFontByFamily } from '@/lib/invite/fonts'
import { ChevronDown, ChevronUp } from 'lucide-react'
import FontPicker from '@/components/invite/FontPicker'
import GoodToKnowEditor from '@/components/invite/GoodToKnowEditor'
import Link from 'next/link'

interface EventDetailsTileSettingsProps {
  settings: EventDetailsTileSettings
  onChange: (settings: EventDetailsTileSettings) => void
  /** Orders the Good to know chips by what this kind of event's guests ask first. */
  eventType?: string | null
  /**
   * The real event (0 in the staff Layout Studio). For a real event the date is
   * the event's - it drives reminders and the countdown - so it is changed on
   * Edit Event Details, which also updates it here, and shown read-only here.
   */
  eventId?: number
  /**
   * Where the event is, from Edit Event Details (its home): online events are
   * the ones without a city. Words the location line to match; absent in the
   * staff Layout Studio.
   */
  eventWhere?: { online: boolean; city?: string }
}

export default function EventDetailsTileSettings({ settings, onChange, eventType, eventId = 0, eventWhere }: EventDetailsTileSettingsProps) {
  const online = !!eventWhere?.online
  const dateIsEvents = eventId > 0
  const [showBorderStyling, setShowBorderStyling] = useState(false)
  const [showAppearance, setShowAppearance] = useState(false)

  const handleLocationChange = (newLocation: string) => {
    // Display name only. The map destination belongs to the Directions tile.
    onChange({ ...settings, location: newLocation })
  }

  return (
    <div className="space-y-4">
      {/* Date and Time - Core event information */}
      <div>
        <label className="block text-sm font-medium mb-2">Date *</label>
        <Input
          type="date"
          value={settings.date || ''}
          onChange={(e) => onChange({ ...settings, date: e.target.value })}
          required={!dateIsEvents}
          readOnly={dateIsEvents}
          aria-readonly={dateIsEvents}
          className={dateIsEvents ? 'cursor-not-allowed bg-gray-100 text-gray-500' : undefined}
        />
        {dateIsEvents && (
          <p className="mt-1 text-xs text-gray-500">
            The event’s date.{' '}
            <Link href={`/host/events/${eventId}/details`} className="font-medium text-eco-teal underline underline-offset-2">
              Change it on Event Details →
            </Link>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-2">Time</label>
          <Input
            type="time"
            value={settings.time || ''}
            onChange={(e) => {
              // Preserve time value - convert empty string to undefined for cleaner JSON
              const timeValue = e.target.value.trim() || undefined
              onChange({ ...settings, time: timeValue })
            }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">End time</label>
          <Input
            type="time"
            value={settings.endTime || ''}
            onChange={(e) => onChange({ ...settings, endTime: e.target.value.trim() || undefined })}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Repeats</label>
        <Input
          type="text"
          value={settings.repeats || ''}
          placeholder="e.g. Saturdays, Every weekend"
          onChange={(e) => onChange({ ...settings, repeats: e.target.value || undefined })}
        />
        <p className="text-xs text-gray-500 mt-1">
          Optional. Shown in the Compact layout as “When”, with the date as the start.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Layout</label>
        <select
          value={settings.dateLayout || 'single-line'}
          onChange={(e) =>
            onChange({ ...settings, dateLayout: e.target.value as NonNullable<EventDetailsTileSettings['dateLayout']> })
          }
          className="w-full text-sm border rounded px-3 py-2"
        >
          <option value="single-line">Single line (e.g. Saturday, June 14, 2025)</option>
          <option value="day-prominent">Day prominent (large 2nd, then month year, then weekday · time)</option>
          <option value="compact">Compact card (When / Starts / Where rows)</option>
        </select>
      </div>

      {/* Location line - display text only. In person or online is the event's, set on Event Details. */}
      <div>
        {eventWhere && eventId > 0 && (
          <p className="mb-2 text-xs text-gray-600">
            <span className="font-semibold text-gray-800">
              {online ? 'Online event' : `In person${eventWhere.city ? ` · ${eventWhere.city}` : ''}`}
            </span>{' '}
            ·{' '}
            <Link href={`/host/events/${eventId}/details`} className="font-medium text-eco-teal underline underline-offset-2">
              Change on Event Details →
            </Link>
          </p>
        )}
        <label htmlFor="event-details-location" className="block text-sm font-medium mb-2">
          {online ? 'How guests join' : 'Venue line'}
        </label>
        <Input
          id="event-details-location"
          value={settings.location || ''}
          onChange={(e) => handleLocationChange(e.target.value)}
          placeholder={online ? 'Online · link shared after you RSVP' : 'The Lakeside Lawns, Udaipur'}
        />
        <p className="text-xs text-gray-500 mt-1">
          Exactly what guests read under Location. Leave it empty and the line is not shown.
        </p>
      </div>

      {/* Good to know - where the lone Dress Code field used to be */}
      <div>
        <p className="block text-sm font-medium mb-1">Good to know</p>
        <p className="text-xs text-gray-500 mb-2">
          Answers to what guests usually ask. Only what you fill in appears on your invitation.
        </p>
        <GoodToKnowEditor
          items={settings.goodToKnow ?? []}
          onChange={(goodToKnow) => onChange({ ...settings, goodToKnow: goodToKnow.length ? goodToKnow : undefined })}
          eventType={eventType}
        />
      </div>

      {/* Appearance - collapsed by default.
          A host opening this tile is nearly always here to set a date or a
          venue. Twelve styling controls above the fold buried the two fields
          that matter, so the facts stay visible and the finish folds away. */}
      <div className="border-t pt-4 mt-4">
        <button
          type="button"
          onClick={() => setShowAppearance(!showAppearance)}
          className="flex items-center justify-between w-full text-left mb-2"
          aria-expanded={showAppearance}
        >
          <h3 className="text-sm font-semibold text-gray-700">Appearance</h3>
          {showAppearance ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>

        {showAppearance && (
          <div className="space-y-4">


        {/* Border Styling Options */}
        <div className="border-t pt-4 mt-4">
          <button
            type="button"
            onClick={() => setShowBorderStyling(!showBorderStyling)}
            className="flex items-center justify-between w-full text-left mb-2"
          >
            <h3 className="text-sm font-semibold text-gray-700">Border Styling</h3>
            {showBorderStyling ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>

          {showBorderStyling && (
            <div>

              {/* Border Style Preset */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Border Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['elegant', 'minimal', 'ornate', 'modern', 'classic', 'vintage', 'none'] as const).map((style) => {
                    const isSelected = (settings.borderStyle || 'elegant') === style
                    const borderConfig = {
                      elegant: { symbol: '❦', lineStyle: 'gradient' },
                      minimal: { symbol: '', lineStyle: 'solid' },
                      ornate: { symbol: '✿', lineStyle: 'gradient' },
                      modern: { symbol: '•', lineStyle: 'dotted' },
                      classic: { symbol: '', lineStyle: 'double' },
                      vintage: { symbol: '✦', lineStyle: 'gradient' },
                      none: { symbol: '', lineStyle: 'none' },
                    }[style]

                    const previewColor = '#D1D5DB'

                    return (
                      <button
                        key={style}
                        type="button"
                        onClick={() => onChange({ ...settings, borderStyle: style })}
                        className={`p-3 border-2 rounded-md text-left transition-all ${isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                      >
                        <div className="text-xs font-medium mb-2 capitalize">{style}</div>
                        {style === 'none' ? (
                          <div className="h-8 flex items-center justify-center text-gray-400 text-xs">
                            No border
                          </div>
                        ) : (
                          <div className="h-8 flex items-center justify-center">
                            {borderConfig.lineStyle === 'gradient' ? (
                              <>
                                <div
                                  className="flex-1 h-px bg-gradient-to-r from-transparent via-current to-transparent"
                                  style={{ color: previewColor, height: '1px' }}
                                />
                                {borderConfig.symbol && (
                                  <div className="mx-2 text-sm" style={{ color: previewColor }}>
                                    {borderConfig.symbol}
                                  </div>
                                )}
                                <div
                                  className="flex-1 h-px bg-gradient-to-r from-transparent via-current to-transparent"
                                  style={{ color: previewColor, height: '1px' }}
                                />
                              </>
                            ) : borderConfig.lineStyle === 'solid' ? (
                              <div
                                className="w-full h-px"
                                style={{ borderTop: '1px solid', borderColor: previewColor }}
                              />
                            ) : borderConfig.lineStyle === 'dotted' ? (
                              <>
                                <div
                                  className="flex-1 h-px border-t border-dotted"
                                  style={{ borderColor: previewColor, borderTopWidth: '1px' }}
                                />
                                {borderConfig.symbol && (
                                  <div className="mx-2 text-sm" style={{ color: previewColor }}>
                                    {borderConfig.symbol}
                                  </div>
                                )}
                                <div
                                  className="flex-1 h-px border-t border-dotted"
                                  style={{ borderColor: previewColor, borderTopWidth: '1px' }}
                                />
                              </>
                            ) : borderConfig.lineStyle === 'double' ? (
                              <div
                                className="w-full h-px"
                                style={{ borderTop: '1px double', borderColor: previewColor }}
                              />
                            ) : null}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Click a border style to preview and select
                </p>
              </div>

              {/* Only show border customization if borderStyle is not 'none' */}
              {/* Border colour, width and the decorative symbol were here. Colour
                  and width come from the invitation's palette now, and the symbol
                  from its one ornament setting, so a fleuron cannot land on this
                  card and nowhere else. All eight border styles stay: which rule
                  the card draws is what it is, not what it looks like. */}

            </div>
          )}
        </div>
          </div>
        )}
      </div>
    </div>
  )
}
