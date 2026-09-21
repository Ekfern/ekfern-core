'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import type { PosterTileSettings } from '@/lib/invite/schema'
import PosterTile from '@/components/invite/tiles/PosterTile'

/**
 * The poster tile's panel is a preview and a way in — nothing else.
 *
 * It used to carry its own background picker, gradient presets, raw-CSS field
 * and text-overlay modal, all duplicating the card editor and all weaker than
 * it. The card is now edited in one place, opened from here.
 */

interface PosterTileSettingsProps {
  settings: PosterTileSettings
  onChange: (settings: PosterTileSettings) => void
  eventId: number
}

export default function PosterTileSettings({ settings, eventId }: PosterTileSettingsProps) {
  const router = useRouter()
  const hasContent = !!settings.src || !!settings.backgroundGradient

  return (
    <div className="space-y-4 w-full max-w-full overflow-x-hidden min-w-0">
      <div>
        <p className="block text-sm font-medium mb-2">Card preview</p>
        {hasContent ? (
          settings.frameMode === 'full-bleed' ? (
            // A poster has no shape of its own to preview into - it is whatever
            // the picture is - so the box takes its height from the render
            // rather than declaring 9:16 and disagreeing with the real page.
            <div className="mx-auto rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ width: 200 }}>
              <PosterTile settings={settings} preview />
            </div>
          ) : (
            // The card does have a declared 9:16 shape. Render at full width
            // (384px = max-w-sm) then scale down so text wraps identically to
            // the mobile preview — just smaller.
            <div className="mx-auto rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ width: 200, height: Math.round(200 * 16 / 9) }}>
              <div style={{ width: 384, transformOrigin: 'top left', transform: `scale(${200 / 384})` }}>
                <PosterTile settings={settings} preview />
              </div>
            </div>
          )
        ) : (
          <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-3 py-8 text-center">
            <p className="text-xs text-gray-500 leading-relaxed">
              No card yet. Open the card editor to pick a background and add your own text.
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => router.push(`/host/events/${eventId}/design`)}
        className="w-full px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        {hasContent ? 'Edit card' : 'Create card'}
      </button>
    </div>
  )
}
