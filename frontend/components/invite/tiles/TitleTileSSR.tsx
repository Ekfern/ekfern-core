import React from 'react'
import { TitleTileSettings } from '@/lib/invite/schema'
import { recipe, recipeAtSize } from '@/lib/invite/recipes'
import { SUBTITLE_SIZE_STEP, TITLE_SIZE_STEP } from '@/lib/invite/titleScale'

interface TitleTileSSRProps {
  settings: TitleTileSettings
  overlayMode?: boolean
}

/**
 * Server-rendered twin of TitleTile.
 *
 * The two had quietly drifted: this one padded `py-8` where the client used
 * `py-10`, set the headline `font-bold` where the client set `font-light`, and
 * carried a size scale a step smaller at every stop - so a title changed weight
 * and size the moment the page hydrated. They now share both the recipes and
 * `TITLE_SIZE_STEP`, which is the only way two files rendering one tile stay
 * honest.
 */
export default function TitleTileSSR({ settings, overlayMode = false }: TitleTileSSRProps) {
  const text = settings.text || 'Event Title'
  const size = settings.size || 'medium'
  const textAlign = settings.textAlign || 'center'
  const alignItemsClass = textAlign === 'left' ? 'items-start' : textAlign === 'right' ? 'items-end' : 'items-center'
  const textAlignClass = textAlign === 'left' ? 'text-left' : textAlign === 'right' ? 'text-right' : 'text-center'
  const subtitleMarginClass = textAlign === 'left' ? 'mr-auto' : textAlign === 'right' ? 'ml-auto' : 'mx-auto'

  const eyebrow = settings.eyebrow?.trim()
  const subtitle = settings.subtitle?.trim()
  const subtitleSize = settings.subtitleSize || 'medium'

  // Overlay mode - positioned inside a poster rather than in normal flow.
  if (overlayMode) {
    const position = settings.overlayPosition || { x: 50, y: 50 }
    return (
      <div
        className="absolute z-10"
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          transform: 'translate(-50%, -50%)',
          color: 'var(--theme-fg)',
          textAlign: 'center',
        }}
      >
        <h1 className="leading-tight" style={recipeAtSize('title', TITLE_SIZE_STEP[size])}>
          {text}
        </h1>
      </div>
    )
  }

  return (
    <div
      className={`w-full py-10 px-6 ${textAlignClass} flex flex-col ${alignItemsClass} justify-center`}
      style={{ color: 'var(--theme-fg)' }}
    >
      {eyebrow && (
        <p className={`mb-3 ${textAlignClass}`} style={recipe('eyebrow')}>
          {eyebrow}
        </p>
      )}
      <h1 className={`leading-tight ${textAlignClass}`} style={recipeAtSize('title', TITLE_SIZE_STEP[size])}>
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
