'use client'

import React, { useState } from 'react'
import type { EventDetailsTileSettings } from '@/lib/invite/schema'
import { colorInputValue } from '@/lib/invite/colorInputValue'
import { Input } from '@/components/ui/input'
import { FONT_OPTIONS, findFontByFamily } from '@/lib/invite/fonts'
import { ChevronDown, ChevronUp } from 'lucide-react'

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
          <option value="day-prominent">Day prominent (large day number, then weekday · time, month year)</option>
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
        {/* Header Font */}
        <div>
          <label className="block text-sm font-medium mb-2">Header Font</label>

          <select
            value={findFontByFamily(settings.headerFontFamily)?.id || ''}
            onChange={(e) => {
              const font = FONT_OPTIONS.find((f) => f.id === e.target.value)
              onChange({
                ...settings,
                headerFontFamily: font?.family,
              })
            }}
            className="w-full text-sm border rounded px-3 py-2"
          >
            <option value="">Theme Default</option>
            {FONT_OPTIONS.map((font) => (
              <option
                key={font.id}
                value={font.id}
                style={{ fontFamily: font.family }}
              >
                {font.name} ({font.category})
              </option>
            ))}
          </select>

          <p className="text-xs text-gray-500 mt-1">
            Preview:{' '}
            <span
              style={settings.headerFontFamily ? { fontFamily: settings.headerFontFamily } : undefined}
            >
              Wednesday, August 5, 2026
            </span>
          </p>
        </div>

        {/* Content Font */}
        <div>
          <label className="block text-sm font-medium mb-2">Content Font</label>

          <select
            value={findFontByFamily(settings.contentFontFamily)?.id || ''}
            onChange={(e) => {
              const font = FONT_OPTIONS.find((f) => f.id === e.target.value)
              onChange({
                ...settings,
                contentFontFamily: font?.family,
              })
            }}
            className="w-full text-sm border rounded px-3 py-2"
          >
            <option value="">Theme Default</option>
            {FONT_OPTIONS.map((font) => (
              <option
                key={font.id}
                value={font.id}
                style={{ fontFamily: font.family }}
              >
                {font.name} ({font.category})
              </option>
            ))}
          </select>

          <p className="text-xs text-gray-500 mt-1">
            Preview:{' '}
            <span
              style={settings.contentFontFamily ? { fontFamily: settings.contentFontFamily } : undefined}
            >
              Wednesday, August 5, 2026
            </span>
          </p>
        </div>

        {/* Styling Options */}
        <div>
          <label className="block text-sm font-medium mb-2">Font Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={colorInputValue(settings.fontColor, '#1F2937')}
              onChange={(e) => onChange({ ...settings, fontColor: e.target.value })}
              className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
            />
            <Input
              type="text"
              value={settings.fontColor ?? ''}
              onChange={(e) => onChange({ ...settings, fontColor: e.target.value })}
              placeholder="#1F2937"
              className="flex-1"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Color for the event details text (date, time, location, dress code)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Button Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={colorInputValue(settings.buttonColor, '#1F2937')}
              onChange={(e) => onChange({ ...settings, buttonColor: e.target.value })}
              className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
            />
            <Input
              type="text"
              value={settings.buttonColor ?? ''}
              onChange={(e) => onChange({ ...settings, buttonColor: e.target.value })}
              placeholder="#1F2937"
              className="flex-1"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Color for the "Save the Date" button border and text. Text color will automatically adjust for contrast.
          </p>
        </div>


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
              {settings.borderStyle !== 'none' && (
                <>
                  {/* Border Color */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Border Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={colorInputValue(settings.borderColor, '#D1D5DB')}
                        onChange={(e) => onChange({ ...settings, borderColor: e.target.value })}
                        className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={settings.borderColor ?? ''}
                        onChange={(e) => onChange({ ...settings, borderColor: e.target.value })}
                        placeholder="#D1D5DB"
                        className="flex-1"
                      />
                    </div>
                  </div>

                  {/* Border Width */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">
                      Border Width: {settings.borderWidth ?? 1}px
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      value={settings.borderWidth ?? 1}
                      onChange={(e) => onChange({
                        ...settings,
                        borderWidth: parseInt(e.target.value)
                      })}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Adjust border thickness (1-4 pixels)
                    </p>
                  </div>

                  {/* Decorative Symbol (only for styles that support it) */}
                  {(settings.borderStyle === 'elegant' ||
                    settings.borderStyle === 'ornate' ||
                    settings.borderStyle === 'modern' ||
                    settings.borderStyle === 'vintage') && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">Decorative Symbol</label>
                        <div className="flex items-center gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() => onChange({ ...settings, decorativeSymbol: '❦' })}
                            className={`px-3 py-2 border rounded text-lg ${settings.decorativeSymbol === '❦' ? 'bg-gray-100' : ''
                              }`}
                          >
                            ❦
                          </button>
                          <button
                            type="button"
                            onClick={() => onChange({ ...settings, decorativeSymbol: '✿' })}
                            className={`px-3 py-2 border rounded text-lg ${settings.decorativeSymbol === '✿' ? 'bg-gray-100' : ''
                              }`}
                          >
                            ✿
                          </button>
                          <button
                            type="button"
                            onClick={() => onChange({ ...settings, decorativeSymbol: '✦' })}
                            className={`px-3 py-2 border rounded text-lg ${settings.decorativeSymbol === '✦' ? 'bg-gray-100' : ''
                              }`}
                          >
                            ✦
                          </button>
                          <button
                            type="button"
                            onClick={() => onChange({ ...settings, decorativeSymbol: '•' })}
                            className={`px-3 py-2 border rounded text-lg ${settings.decorativeSymbol === '•' ? 'bg-gray-100' : ''
                              }`}
                          >
                            •
                          </button>
                          <button
                            type="button"
                            onClick={() => onChange({ ...settings, decorativeSymbol: '' })}
                            className={`px-3 py-2 border rounded text-sm ${!settings.decorativeSymbol ? 'bg-gray-100' : ''
                              }`}
                          >
                            None
                          </button>
                        </div>
                        <Input
                          type="text"
                          value={settings.decorativeSymbol || ''}
                          onChange={(e) => onChange({ ...settings, decorativeSymbol: e.target.value })}
                          placeholder="Custom symbol (optional)"
                          className="w-full"
                          maxLength={1}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Custom decorative symbol (leave empty to use style default)
                        </p>
                      </div>
                    )}
                </>
              )}

              {/* Background Color */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Background Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={colorInputValue(settings.backgroundColor, '#FFFFFF')}
                    onChange={(e) => onChange({ ...settings, backgroundColor: e.target.value })}
                    className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={settings.backgroundColor || ''}
                    onChange={(e) => onChange({
                      ...settings,
                      backgroundColor: e.target.value || undefined
                    })}
                    placeholder="Transparent (leave empty)"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Background color for the event details tile (leave empty for transparent)
                </p>
              </div>

              {/* Border Radius */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Border Radius: {settings.borderRadius ?? 0}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={settings.borderRadius ?? 0}
                  onChange={(e) => onChange({
                    ...settings,
                    borderRadius: parseInt(e.target.value)
                  })}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Rounded corners (0 = sharp corners, 24 = very rounded)
                </p>
              </div>
            </div>
          )}
        </div>
          </div>
        )}
      </div>
    </div>
  )
}
