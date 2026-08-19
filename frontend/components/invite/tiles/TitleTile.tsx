'use client'

import React from 'react'
import { TitleTileSettings } from '@/lib/invite/schema'
import { FONT_OPTIONS } from '@/lib/invite/fonts'

export interface TitleTileProps {
  settings: TitleTileSettings
  preview?: boolean
}

export default function TitleTile({ settings, preview = false }: TitleTileProps) {
  const fontFamily = settings.font || `var(--theme-font-title, ${FONT_OPTIONS[0].family})`
  const color = settings.color || 'var(--theme-fg, #000000)'
  const text = settings.text || 'Event Title'
  const size = settings.size || 'medium'
  const textAlign = settings.textAlign || 'center'
  const alignItemsClass = textAlign === 'left' ? 'items-start' : textAlign === 'right' ? 'items-end' : 'items-center'
  const textAlignClass = textAlign === 'left' ? 'text-left' : textAlign === 'right' ? 'text-right' : 'text-center'
  const subtitleMarginClass = textAlign === 'left' ? 'mr-auto' : textAlign === 'right' ? 'ml-auto' : 'mx-auto'

  // Size classes mapping — no `md:` escalation: this component only ever
  // renders inside host-facing preview surfaces (Page Editor's Mobile
  // Preview, Layout gallery cards) that simulate a narrow phone frame
  // regardless of the real browser width. `md:` checks the real viewport,
  // not the frame, so escalating here caused oversized text to overflow the
  // frame on desktop. The guest-facing page renders via TitleTileSSR
  // instead, which is untouched by this change.
  const sizeClasses = {
    small: 'text-2xl',
    medium: 'text-4xl',
    large: 'text-5xl',
    xlarge: 'text-6xl',
  }

  const titleClassName = sizeClasses[size]
  const eyebrow = settings.eyebrow?.trim()
  const eyebrowColor = settings.eyebrowColor || 'var(--theme-primary, #D4A017)'
  const subtitle = settings.subtitle?.trim()
  // A subtitle is supporting text, so it falls back to the body face rather
  // than to FONT_OPTIONS[0] - which is Helvetica, and has nothing to do with
  // this invitation.
  const subtitleFont = settings.subtitleFont || 'var(--theme-font-body, inherit)'
  const subtitleColor = settings.subtitleColor ?? color
  const subtitleSize = settings.subtitleSize || 'medium'
  const subtitleSizeClasses = {
    small: 'text-sm md:text-base',
    medium: 'text-base md:text-lg',
    large: 'text-lg md:text-xl',
  }

  if (preview) {
    return (
      <div className={`w-full py-10 px-6 ${textAlignClass} flex flex-col ${alignItemsClass} justify-center`} style={{ fontFamily, color }}>
        {eyebrow && (
          <p className={`text-xs font-semibold tracking-[0.3em] uppercase mb-3 ${textAlignClass}`} style={{ color: eyebrowColor }}>
            {eyebrow}
          </p>
        )}
        <h1 className={`${titleClassName} font-light leading-tight tracking-wide ${textAlignClass}`}>{text}</h1>
        {subtitle && (
          <p className={`${subtitleSizeClasses[subtitleSize]} mt-4 font-light tracking-widest uppercase ${textAlignClass} ${subtitleMarginClass} max-w-xl opacity-80`} style={{ fontFamily: subtitleFont, color: subtitleColor }}>
            {subtitle}
          </p>
        )}
      </div>
    )
  }

  // Settings mode - just show a preview
  const previewSizeClasses = {
    small: 'text-lg',
    medium: 'text-xl',
    large: 'text-2xl',
    xlarge: 'text-3xl',
  }
  return (
    <div className="w-full py-4 px-4 text-center border rounded" style={{ fontFamily, color }}>
      <h2 className={`${previewSizeClasses[size]} font-bold`}>{text || 'Event Title'}</h2>
      {subtitle && (
        <p className={`${subtitleSize === 'small' ? 'text-sm' : subtitleSize === 'large' ? 'text-base' : 'text-sm'} mt-2`} style={{ fontFamily: subtitleFont, color: subtitleColor }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
