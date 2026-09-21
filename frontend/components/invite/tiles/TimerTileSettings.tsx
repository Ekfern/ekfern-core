'use client'

import React from 'react'
import type { TimerTileSettings } from '@/lib/invite/schema'

interface TimerTileSettingsProps {
  settings: TimerTileSettings
  onChange: (settings: TimerTileSettings) => void
}

/**
 * How the countdown is arranged.
 *
 * Whether there is one is the tile's own checkbox, as it is for every tile.
 * This panel used to carry a second "Show countdown" switch that meant the same
 * thing, and the two read a missing value oppositely: absent drew the box
 * ticked and rendered nothing. Migration 0109 folded it into tile.enabled.
 *
 * The circle colour and the text colour used to live here. They were two more
 * ways for one tile to disagree with the invitation around it - a magenta
 * countdown on a cream page was a couple of clicks away and looked like a bug.
 * The countdown is painted in the page's accent now.
 */
export default function TimerTileSettingsPanel({ settings, onChange }: TimerTileSettingsProps) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="timer-format" className="block text-sm font-medium mb-2">Layout</label>
        <select
          id="timer-format"
          value={settings.format || 'circle'}
          onChange={(e) => onChange({ ...settings, format: e.target.value as TimerTileSettings['format'] })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
        >
          <option value="circle">Circles</option>
          <option value="inline">One line</option>
        </select>
      </div>
    </div>
  )
}
