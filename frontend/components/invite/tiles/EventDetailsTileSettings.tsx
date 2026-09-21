'use client'

import React, { useState } from 'react'
import type { EventDetailsTileSettings } from '@/lib/invite/schema'
import { colorInputValue } from '@/lib/invite/colorInputValue'
import { Input } from '@/components/ui/input'
import { FONT_OPTIONS, findFontByFamily } from '@/lib/invite/fonts'
import { ChevronDown, ChevronUp } from 'lucide-react'
import FontPicker from '@/components/invite/FontPicker'

interface EventDetailsTileSettingsProps {
  settings: EventDetailsTileSettings
  onChange: (settings: EventDetailsTileSettings) => void
}

export default function EventDetailsTileSettings({ settings, onChange }: EventDetailsTileSettingsProps) {
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
          required
        />
      </div>

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
        <label className="block text-sm font-medium mb-2">Date layout</label>
        <select
          value={settings.dateLayout || 'single-line'}
          onChange={(e) => onChange({ ...settings, dateLayout: e.target.value as 'single-line' | 'day-prominent' })}
          className="w-full text-sm border rounded px-3 py-2"
        >
          <option value="single-line">Single line (e.g. Saturday, June 14, 2025)</option>
          <option value="day-prominent">Day prominent (large 2nd, then month year, then weekday · time)</option>
        </select>
      </div>

      {/* Location Input - Display text only */}
      <div>
        <label className="block text-sm font-medium mb-2">Location *</label>
        <Input
          value={settings.location || ''}
          onChange={(e) => handleLocationChange(e.target.value)}
          placeholder="e.g., Grand Ballroom, Main Hall, Beachside Venue"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Enter the display name for your event location (this appears on your invitation)
        </p>
      </div>

      {/* Additional Details */}
      <div>
        <label className="block text-sm font-medium mb-2">Dress Code (optional)</label>
        <Input
          value={settings.dressCode || ''}
          onChange={(e) => onChange({ ...settings, dressCode: e.target.value || undefined })}
          placeholder="e.g., Formal, Casual, Traditional"
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
