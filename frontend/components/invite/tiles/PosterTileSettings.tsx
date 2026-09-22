'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { PosterTileSettings } from '@/lib/invite/schema'
import { Button } from '@/components/ui/button'
import DesignMediaPicker from '@/components/invite/DesignMediaPicker'
import TextOverlayEditorModal from '@/components/invite/TextOverlayEditorModal'
import PosterTile from '@/components/invite/tiles/PosterTile'

/**
 * The poster tile's panel, in two contexts.
 *
 * With an event (the host's page editor) it is a preview and a way in: the
 * card is edited in one place, the card editor, and this panel does not
 * duplicate it.
 *
 * Without one (`eventId` 0, the staff Page Layout Studio) there is no card
 * editor to hand off to, so the authoring controls live here: pick artwork
 * from the Design Studio catalog, set a gradient, and place text. A layout is
 * a template, so its poster carries the design's feel; the words a host writes
 * are still theirs, added later in the card editor.
 */

function parseLinearGradient(css: string): { angle: string; color1: string; color2: string } {
  const defaults = { angle: '135deg', color1: '#fce4ec', color2: '#f48fb1' }
  if (!css) return defaults
  const m = css.match(/linear-gradient\(\s*([^,]+),\s*(#[0-9a-fA-F]{3,6})[^,]*,\s*(#[0-9a-fA-F]{3,6})/)
  if (!m) return defaults
  return { angle: m[1]!.trim(), color1: m[2]!, color2: m[3]! }
}

const GRADIENT_DIRECTIONS = [
  { label: '↘ Diagonal', value: '135deg' },
  { label: '↓ Down',     value: '180deg' },
  { label: '→ Right',    value: '90deg'  },
  { label: '↗ Up-right', value: '45deg'  },
]

const PRESET_GRADIENTS = [
  { label: 'Rose Blush',    value: 'linear-gradient(135deg, #fce4ec, #f48fb1)' },
  { label: 'Sage Mist',     value: 'linear-gradient(135deg, #e8f5e9, #81c784)' },
  { label: 'Dusk Blue',     value: 'linear-gradient(135deg, #e3f2fd, #64b5f6)' },
  { label: 'Golden Hour',   value: 'linear-gradient(135deg, #fff8e1, #ffca28)' },
  { label: 'Lavender',      value: 'linear-gradient(135deg, #f3e5f5, #ce93d8)' },
  { label: 'Peach Cream',   value: 'linear-gradient(135deg, #fff3e0, #ffb74d)' },
  { label: 'Midnight',      value: 'linear-gradient(135deg, #1a1a2e, #16213e)' },
  { label: 'Forest',        value: 'linear-gradient(135deg, #1b4332, #40916c)' },
]

interface PosterTileSettingsProps {
  settings: PosterTileSettings
  onChange: (settings: PosterTileSettings) => void
  /** 0 in the page layout studio, where there is no event to design against. */
  eventId: number
}

export default function PosterTileSettings({ settings, onChange, eventId }: PosterTileSettingsProps) {
  const router = useRouter()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [overlayEditorOpen, setOverlayEditorOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const hasEvent = eventId > 0
  const hasContent = !!settings.src || !!settings.backgroundGradient

  // Derived once so the pickers reflect what is applied when the panel opens.
  const parsed = useMemo(
    () => parseLinearGradient(settings.backgroundGradient ?? ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const [gradAngle, setGradAngle] = useState(parsed.angle)
  const [gradColor1, setGradColor1] = useState(parsed.color1)
  const [gradColor2, setGradColor2] = useState(parsed.color2)

  function applyCustomGradient(angle: string, c1: string, c2: string) {
    onChange({ ...settings, backgroundGradient: `linear-gradient(${angle}, ${c1}, ${c2})` })
  }

  const preview = (
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
            {hasEvent
              ? 'No card yet. Open the card editor to pick a background and add your own text.'
              : 'No poster yet. Browse the library or set a gradient below.'}
          </p>
        </div>
      )}
    </div>
  )

  if (hasEvent) {
    return (
      <div className="space-y-4 w-full max-w-full overflow-x-hidden min-w-0">
        {preview}
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

  return (
    <div className="space-y-4 w-full max-w-full overflow-x-hidden min-w-0">
      {preview}

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setPickerOpen(true)}
      >
        Browse Media Library
      </Button>

      <button
        type="button"
        onClick={() => setOverlayEditorOpen(true)}
        className="w-full px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        Edit text overlays
      </button>

      <DesignMediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(src) => onChange({ ...settings, src })}
      />

      <TextOverlayEditorModal
        open={overlayEditorOpen}
        bgSrc={settings.src}
        bgGradient={settings.backgroundGradient}
        initialOverlays={settings.textOverlays ?? []}
        onSave={(overlays) => onChange({ ...settings, textOverlays: overlays })}
        onClose={() => setOverlayEditorOpen(false)}
      />

      {!settings.src && (
        <div className="space-y-3">
          <label className="block text-sm font-medium">Background Color / Gradient</label>

          <div className="grid grid-cols-4 gap-2">
            {PRESET_GRADIENTS.map((g) => (
              <button
                key={g.value}
                type="button"
                title={g.label}
                onClick={() => onChange({ ...settings, backgroundGradient: g.value })}
                className="h-10 rounded-lg border-2 transition-all"
                style={{
                  background: g.value,
                  borderColor: settings.backgroundGradient === g.value ? '#3b82f6' : 'transparent',
                }}
              />
            ))}
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
            <p className="text-xs font-medium text-gray-600">Custom gradient</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={gradColor1}
                onChange={(e) => {
                  setGradColor1(e.target.value)
                  applyCustomGradient(gradAngle, e.target.value, gradColor2)
                }}
                className="w-9 h-9 rounded border border-gray-300 cursor-pointer p-0.5 flex-none"
                title="Start color"
              />
              <div
                className="flex-1 h-9 rounded-md border border-gray-200"
                style={{ background: `linear-gradient(90deg, ${gradColor1}, ${gradColor2})` }}
              />
              <input
                type="color"
                value={gradColor2}
                onChange={(e) => {
                  setGradColor2(e.target.value)
                  applyCustomGradient(gradAngle, gradColor1, e.target.value)
                }}
                className="w-9 h-9 rounded border border-gray-300 cursor-pointer p-0.5 flex-none"
                title="End color"
              />
            </div>
            <select
              value={gradAngle}
              onChange={(e) => {
                setGradAngle(e.target.value)
                applyCustomGradient(e.target.value, gradColor1, gradColor2)
              }}
              className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
            >
              {GRADIENT_DIRECTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {advancedOpen ? '▾ Hide advanced' : '▸ Advanced: paste custom CSS'}
            </button>
            {advancedOpen && (
              <div className="mt-2 space-y-1">
                <input
                  type="text"
                  value={settings.backgroundGradient || ''}
                  onChange={(e) => onChange({ ...settings, backgroundGradient: e.target.value || undefined })}
                  placeholder="linear-gradient(135deg, #fce4ec, #f48fb1)"
                  className="w-full text-xs border rounded px-3 py-2 font-mono"
                  spellCheck={false}
                />
                <p className="text-xs text-gray-400">Any valid CSS gradient or solid hex color</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
