'use client'

import React, { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import type { InviteConfig } from '@/lib/invite/schema'
import { resolveAppearance } from '@/lib/invite/appearance'
import { deriveInk } from '@/lib/invite/paletteUtils'
import { extractDominantColors, rgbToHex } from '@/lib/invite/imageAnalysis'

/**
 * Page background and texture, shared by the host's page editor and the staff
 * page layout studio.
 *
 * It reads and writes `config` and nothing else — no event, no layout, no
 * fetching — which is why both surfaces can mount it. The studio used to carry
 * a hand-copied subset of this (a solid colour picker only), so gradients and
 * auto-from-card were unreachable when authoring a layout.
 */

interface PageBackgroundSettingsProps {
  config: InviteConfig
  setConfig: React.Dispatch<React.SetStateAction<InviteConfig>>
  /**
   * Changes when a freshly loaded config arrives, so the gradient pickers
   * re-read it. Deliberately not `config` itself: that would fight the user on
   * every edit. The page editor passes its event id, the studio its layout id.
   */
  syncKey?: string | number
  /** Collapsed by default in the page editor; the studio shows it open. */
  defaultOpen?: boolean
}

export default function PageBackgroundSettings({
  config,
  setConfig,
  syncKey,
  defaultOpen = false,
}: PageBackgroundSettingsProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [canRestoreBg, setCanRestoreBg] = useState(false)
  const [gradientColor1, setGradientColor1] = useState('#E8D8C3')
  const [gradientColor2, setGradientColor2] = useState('#C4A882')
  const [gradientAngle, setGradientAngle] = useState(160)

  const displayBackgroundColor = resolveAppearance(config).backgroundColor
  const isGradientBg = !!config.customColors?.backgroundGradient

  // Sync the gradient pickers when a new config loads.
  useEffect(() => {
    const saved = config.customColors?.backgroundGradient
    if (!saved) return
    const m = saved.match(/linear-gradient\((\d+)deg,\s*(#[0-9a-fA-F]{3,8})\s+0%,\s*(#[0-9a-fA-F]{3,8})\s+100%\)/)
    if (m) {
      setGradientAngle(parseInt(m[1]!, 10))
      setGradientColor1(m[2]!)
      setGradientColor2(m[3]!)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey])

  const applyBackground = (patch: { backgroundColor?: string; backgroundGradient?: string }) => {
    setConfig(prev => {
      const colors = prev.customColors ?? {}
      if (colors.source === 'custom') {
        return { ...prev, customColors: { ...colors, ...patch } }
      }
      const merged = { ...colors, ...patch }
      if (!merged.backgroundGradient && !merged.backgroundColor) {
        return { ...prev, customColors: merged }
      }
      // The whole background, not a representative colour from it: a gradient
      // has two ends and ink has to be legible at both. Material goes too,
      // because text on a frosted card sits on the blend, not on the page.
      return {
        ...prev,
        customColors: {
          ...merged,
          ...deriveInk({
            backgroundColor: merged.backgroundColor,
            backgroundGradient: merged.backgroundGradient,
            material: prev.material,
          }),
        },
      }
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="flex items-center justify-between w-full text-left focus:outline-none focus:ring-2 focus:ring-eco-green rounded-md"
      >
        <span className="text-sm font-medium">Page Background</span>
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`space-y-3 mt-3 ${open ? '' : 'hidden'}`}>

        {/* Type toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-300 w-fit">
          <button
            type="button"
            onClick={() => applyBackground({ backgroundGradient: undefined })}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${!isGradientBg ? 'bg-eco-green text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Solid
          </button>
          <button
            type="button"
            onClick={() => {
              const g = `linear-gradient(${gradientAngle}deg, ${gradientColor1} 0%, ${gradientColor2} 100%)`
              applyBackground({ backgroundGradient: g })
            }}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${isGradientBg ? 'bg-eco-green text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Gradient
          </button>
        </div>

        {/* Auto from card + restore previous */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              const cardTile = config.tiles?.find(t => t.type === 'poster')
              const cardSrc = (cardTile?.settings as { src?: string } | undefined)?.src
              if (!cardSrc) return
              const prevState = {
                backgroundColor: config.customColors?.backgroundColor,
                backgroundGradient: config.customColors?.backgroundGradient,
              }
              sessionStorage.setItem('bgRestorePrev', JSON.stringify(prevState))
              setCanRestoreBg(true)
              const colors = await extractDominantColors(cardSrc, isGradientBg ? 2 : 1)
              const hex1 = rgbToHex(colors[0] ?? 'rgb(232,216,195)')
              if (isGradientBg) {
                const hex2 = rgbToHex(colors[1] ?? 'rgb(196,168,130)')
                setGradientColor1(hex1)
                setGradientColor2(hex2)
                const g = `linear-gradient(${gradientAngle}deg, ${hex1} 0%, ${hex2} 100%)`
                applyBackground({ backgroundGradient: g })
              } else {
                applyBackground({ backgroundColor: hex1 })
              }
            }}
            className="px-3 py-1.5 text-sm font-medium bg-eco-beige text-eco-green border border-eco-green-light rounded hover:bg-eco-green hover:text-white transition-colors"
          >
            Auto from card
          </button>
          {canRestoreBg && (
            <button
              type="button"
              onClick={() => {
                const raw = sessionStorage.getItem('bgRestorePrev')
                if (!raw) return
                try {
                  const prev = JSON.parse(raw) as { backgroundColor?: string; backgroundGradient?: string }
                  applyBackground({ backgroundColor: prev.backgroundColor, backgroundGradient: prev.backgroundGradient })
                  if (prev.backgroundGradient) {
                    const m = prev.backgroundGradient.match(/linear-gradient\((\d+)deg,\s*(#[0-9a-fA-F]{3,8})\s+0%,\s*(#[0-9a-fA-F]{3,8})\s+100%\)/)
                    if (m) { setGradientAngle(parseInt(m[1]!, 10)); setGradientColor1(m[2]!); setGradientColor2(m[3]!) }
                  }
                  setCanRestoreBg(false)
                  sessionStorage.removeItem('bgRestorePrev')
                } catch { /* ignore */ }
              }}
              className="text-sm text-gray-500 hover:text-eco-green underline"
            >
              ← restore previous
            </button>
          )}
        </div>

        {/* Solid: single color picker */}
        {!isGradientBg && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={displayBackgroundColor}
              onChange={(e) => applyBackground({ backgroundColor: e.target.value })}
              className="w-10 h-10 rounded border-2 border-gray-300 cursor-pointer flex-none"
            />
            <Input
              type="text"
              value={displayBackgroundColor}
              onChange={(e) => applyBackground({ backgroundColor: e.target.value })}
              placeholder="#E8D8C3"
              className="w-32 font-mono text-sm"
            />
          </div>
        )}

        {/* Gradient: two pickers + preview strip + angle */}
        {isGradientBg && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={gradientColor1}
                onChange={(e) => {
                  setGradientColor1(e.target.value)
                  const g = `linear-gradient(${gradientAngle}deg, ${e.target.value} 0%, ${gradientColor2} 100%)`
                  applyBackground({ backgroundGradient: g })
                }}
                className="w-10 h-10 rounded border-2 border-gray-300 cursor-pointer flex-none"
              />
              <div className="flex-1 h-5 rounded" style={{ background: `linear-gradient(to right, ${gradientColor1}, ${gradientColor2})` }} />
              <input
                type="color"
                value={gradientColor2}
                onChange={(e) => {
                  setGradientColor2(e.target.value)
                  const g = `linear-gradient(${gradientAngle}deg, ${gradientColor1} 0%, ${e.target.value} 100%)`
                  applyBackground({ backgroundGradient: g })
                }}
                className="w-10 h-10 rounded border-2 border-gray-300 cursor-pointer flex-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Direction: {gradientAngle}°</label>
              <input
                type="range"
                min={0}
                max={360}
                value={gradientAngle}
                onChange={(e) => {
                  const a = parseInt(e.target.value, 10)
                  setGradientAngle(a)
                  const g = `linear-gradient(${a}deg, ${gradientColor1} 0%, ${gradientColor2} 100%)`
                  applyBackground({ backgroundGradient: g })
                }}
                className="w-full mt-1"
              />
            </div>
          </div>
        )}

        {/* Texture belongs with the background — it coats the same surface. */}
        <div className="border-t border-gray-100 pt-3 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-2">Background Texture</label>
            <select
              value={config.texture?.type || 'none'}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                texture: {
                  ...prev.texture,
                  type: e.target.value as NonNullable<InviteConfig['texture']>['type'],
                  intensity: prev.texture?.intensity ?? 40,
                },
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-eco-green"
            >
              <option value="none">None</option>
              <option value="paper-grain">Paper Grain</option>
              <option value="linen">Linen</option>
              <option value="canvas">Canvas</option>
              <option value="parchment">Parchment</option>
              <option value="vintage-paper">Vintage Paper</option>
              <option value="crumpled-paper">Crumpled Paper</option>
              <option value="stone">Stone Surface</option>
              <option value="silk">Silk</option>
              <option value="marble">Marble</option>
              <option value="stars">Stars</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Coats the page colour — paper textures, or stars for a night sky
            </p>
          </div>

          {config.texture?.type && config.texture.type !== 'none' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Texture Intensity: {config.texture?.intensity ?? 40}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={config.texture?.intensity ?? 40}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  texture: {
                    ...prev.texture!,
                    intensity: parseInt(e.target.value, 10),
                  },
                }))}
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
