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
