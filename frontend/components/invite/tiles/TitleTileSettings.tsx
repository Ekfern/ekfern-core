'use client'

import React from 'react'
import type { TitleTileSettings } from '@/lib/invite/schema'
import { colorInputValue } from '@/lib/invite/colorInputValue'
import { FONT_OPTIONS, findFontByFamily } from '@/lib/invite/fonts'
import { Input } from '@/components/ui/input'
import FontPicker from '@/components/invite/FontPicker'

interface TitleTileSettingsProps {
  settings: TitleTileSettings
  onChange: (settings: TitleTileSettings) => void
}

export default function TitleTileSettings({ settings, onChange }: TitleTileSettingsProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Title Text *</label>
        <Input
          value={settings.text || ''}
          onChange={(e) => onChange({ ...settings, text: e.target.value })}
          placeholder="Event Title"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Font</label>
        <FontPicker
          value={settings.font}
          onChange={(family) => onChange({ ...settings, font: family })}
          defaultLabel="Page headline font"
          ariaLabel="Title font"
        />
        <p className="text-xs text-gray-500 mt-1">
          Preview: <span style={{ fontFamily: settings.font || FONT_OPTIONS[0].family }}>{settings.text || 'Event Title'}</span>
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Text Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={colorInputValue(settings.color, '#000000')}
            onChange={(e) => onChange({ ...settings, color: e.target.value })}
            className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
          />
          <Input
            type="text"
            value={settings.color ?? ''}
            onChange={(e) => onChange({ ...settings, color: e.target.value })}
            placeholder="#000000"
            className="flex-1"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Title Size</label>
        <select
          value={settings.size || 'medium'}
          onChange={(e) => onChange({ ...settings, size: e.target.value as 'small' | 'medium' | 'large' | 'xlarge' })}
          className="w-full text-sm border rounded px-3 py-2"
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
          <option value="xlarge">Extra Large</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Preview size: {settings.size || 'medium'}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Subtitle (optional)</label>
        <Input
          value={settings.subtitle || ''}
          onChange={(e) => onChange({ ...settings, subtitle: e.target.value })}
          placeholder="e.g. Request the pleasure of your company…"
        />
        {settings.subtitle && (
          <div className="mt-2 space-y-2">
            <div>
              <label className="text-xs font-medium text-gray-600">Subtitle font</label>
              <FontPicker
                  value={settings.subtitleFont}
                  onChange={(family) => onChange({ ...settings, subtitleFont: family })}
                  defaultLabel="Page body font"
                  ariaLabel="Subtitle font"
                />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">Subtitle color</label>
              <input
                type="color"
                value={colorInputValue(settings.subtitleColor, colorInputValue(settings.color, '#000000'))}
                onChange={(e) => onChange({ ...settings, subtitleColor: e.target.value })}
                className="w-8 h-8 rounded border cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Subtitle size</label>
              <select
                value={settings.subtitleSize || 'medium'}
                onChange={(e) => onChange({ ...settings, subtitleSize: e.target.value as 'small' | 'medium' | 'large' })}
                className="w-full text-sm border rounded px-2 py-1 mt-0.5"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
