'use client'

import React from 'react'
import { FooterTileSettings } from '@/lib/invite/schema'
import { usePageDesign } from '../render/AppearanceProvider'
import { recipe } from '@/lib/invite/recipes'

export interface FooterTileProps {
  settings: FooterTileSettings
  preview?: boolean
}

/**
 * The closing note.
 *
 * The rule above it is no longer the footer's own decision. It was a checkbox
 * here and a symbol setting on the details card, which meant a host could get a
 * flourish in one place and a hairline in the other without ever choosing
 * either. Both now read the invitation's one ornament setting.
 */
export default function FooterTile({ settings, preview = false }: FooterTileProps) {
  const design = usePageDesign()

  if (!settings.text) {
    if (preview) return null
    return (
      <div className="w-full py-4 px-4 text-center border rounded bg-gray-50">
        <p className="text-gray-400 text-sm">No footer text</p>
      </div>
    )
  }

  // Undefined outside a provider - the editor's tile list - so it falls back to
  // the hairline rather than rendering nothing.
  const divider = design?.dividerStyle ?? 'hairline'
  const symbol = design?.dividerSymbol || '❦'
  const text = (
    <p style={recipe('caption', { color: 'var(--theme-muted)' })}>{settings.text}</p>
  )

  if (preview) {
    return (
      <div
        className={`w-full py-6 px-4 text-center ${divider === 'hairline' ? 'border-t border-current/10' : ''}`}
      >
        {divider === 'symbol' && (
          <p aria-hidden className="mb-3" style={recipe('caption', { color: 'var(--theme-primary)' })}>
            {symbol}
          </p>
        )}
        {text}
      </div>
    )
  }

  return <div className="w-full py-4 px-4 text-center border rounded bg-gray-50">{text}</div>
}
