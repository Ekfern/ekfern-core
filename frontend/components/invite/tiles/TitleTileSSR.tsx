import React from 'react'
import { TitleTileSettings } from '@/lib/invite/schema'
import { FONT_OPTIONS } from '@/lib/invite/fonts'

interface TitleTileSSRProps {
  settings: TitleTileSettings
  overlayMode?: boolean
}

/**
 * Server-safe version of TitleTile
 * Supports both overlay mode (absolute positioning) and standalone mode
 * No client-side hooks or interactions
 */
export default function TitleTileSSR({ settings, overlayMode = false }: TitleTileSSRProps) {
  const fontFamily = settings.font || `var(--theme-font-title, ${FONT_OPTIONS[0].family})`
  const color = settings.color || 'var(--theme-fg, #000000)'
  const text = settings.text || 'Event Title'
  const size = settings.size || 'medium'
  const textAlign = settings.textAlign || 'center'
  const alignItemsClass = textAlign === 'left' ? 'items-start' : textAlign === 'right' ? 'items-end' : 'items-center'
  const textAlignClass = textAlign === 'left' ? 'text-left' : textAlign === 'right' ? 'text-right' : 'text-center'
  const eyebrow = settings.eyebrow?.trim()
  const eyebrowColor = settings.eyebrowColor || 'var(--theme-primary, #D4A017)'

  // Size classes mapping (matches client version)
  const sizeClasses = {
    small: 'text-xl md:text-2xl',
    medium: 'text-3xl md:text-4xl',
    large: 'text-4xl md:text-5xl',
    xlarge: 'text-5xl md:text-6xl',
  }

  const titleClassName = sizeClasses[size]

  // Overlay mode - position within image (matches client TitleTile overlay mode)
  if (overlayMode) {
    const position = settings.overlayPosition || { x: 50, y: 50 }
    return (
      <div
        className="absolute z-10"
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          transform: 'translate(-50%, -50%)',
          fontFamily,
          color,
          textAlign: 'center',
        }}
      >
        <h1 className={`${titleClassName} font-bold`}>{text}</h1>
      </div>
    )
  }

  // Standalone mode - normal flow layout
  return (
    <div className={`w-full py-8 px-4 ${textAlignClass} flex flex-col ${alignItemsClass} justify-center`} style={{ fontFamily, color }}>
      {eyebrow && (
        <p className={`text-xs font-semibold tracking-[0.3em] uppercase mb-3 ${textAlignClass}`} style={{ color: eyebrowColor }}>
          {eyebrow}
        </p>
      )}
      <h1 className={`${titleClassName} font-bold ${textAlignClass}`}>{text}</h1>
    </div>
  )
}
