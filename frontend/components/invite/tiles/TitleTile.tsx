'use client'

import React from 'react'
import { TitleTileSettings } from '@/lib/invite/schema'
import { recipe, recipeAtSize } from '@/lib/invite/recipes'
import { SUBTITLE_SIZE_STEP, TITLE_SIZE_STEP } from '@/lib/invite/titleScale'

export interface TitleTileProps {
  settings: TitleTileSettings
  preview?: boolean
}

/**
 * The invitation's name, and the two small lines that can sit around it.
 *
 * Every question about how this looks is now answered by the page. The tile
 * used to carry a font, a colour, an eyebrow colour, a subtitle font and a
 * subtitle colour - five ways to disagree with the invitation it was part of,
 * and the eyebrow did: it inherited the title face by accident and came out as
 * Pacifico in spaced capitals while the gallery's kicker, doing the same job,
 * came out as Courier.
 *
 * What is left is what the tile is for: the words, which line goes where, and
 * how large the headline should be relative to everything else.
 */
export default function TitleTile({ settings, preview = false }: TitleTileProps) {
  const text = settings.text || 'Event Title'
  const size = settings.size || 'medium'
  const textAlign = settings.textAlign || 'center'
  const alignItemsClass = textAlign === 'left' ? 'items-start' : textAlign === 'right' ? 'items-end' : 'items-center'
  const textAlignClass = textAlign === 'left' ? 'text-left' : textAlign === 'right' ? 'text-right' : 'text-center'
  const subtitleMarginClass = textAlign === 'left' ? 'mr-auto' : textAlign === 'right' ? 'ml-auto' : 'mx-auto'

  const eyebrow = settings.eyebrow?.trim()
  const subtitle = settings.subtitle?.trim()
  const subtitleSize = settings.subtitleSize || 'medium'

  if (preview) {
    return (
      <div
        className={`w-full px-6 ${textAlignClass} flex flex-col ${alignItemsClass} justify-center`}
        style={{ color: 'var(--theme-fg)' }}
      >
        {eyebrow && (
          <p className={`mb-3 ${textAlignClass}`} style={recipe('eyebrow')}>
            {eyebrow}
          </p>
        )}
        <h1
          className={`leading-tight ${textAlignClass}`}
          style={recipeAtSize('title', TITLE_SIZE_STEP[size])}
        >
          {text}
        </h1>
        {subtitle && (
          <p
            className={`mt-4 ${textAlignClass} ${subtitleMarginClass} max-w-xl opacity-80`}
            style={recipeAtSize('caption', SUBTITLE_SIZE_STEP[subtitleSize])}
          >
            {subtitle}
          </p>
        )}
      </div>
    )
  }

  // Settings mode - a small stand-in shown in the editor's tile list.
  return (
    <div className="w-full py-4 px-4 text-center border rounded" style={{ color: 'var(--theme-fg)' }}>
      <h2 style={recipeAtSize('title', '1.25rem')}>{text || 'Event Title'}</h2>
      {subtitle && (
        <p className="mt-2" style={recipeAtSize('caption', '0.8125rem')}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
