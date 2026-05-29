'use client'

import React from 'react'
import { DesignTileSettings } from '@/lib/invite/schema'
import { convertToCloudFrontUrl } from '@/lib/image-utils'

export interface DesignTileProps {
  settings: DesignTileSettings
  preview?: boolean
}

export default function DesignTile({ settings, preview: _preview = false }: DesignTileProps) {
  const hasImage = !!settings.src
  const hasGradient = !!settings.backgroundGradient
  const hasTextOverlays = settings.textOverlays && settings.textOverlays.length > 0

  const renderTextOverlays = () => {
    if (!hasTextOverlays) return null
    return settings.textOverlays!.map((overlay) => {
      const verticalAlign = overlay.verticalAlign ?? 'middle'
      const justifyContent =
        verticalAlign === 'top' ? 'flex-start' : verticalAlign === 'bottom' ? 'flex-end' : 'center'
      const textDecoration = [
        overlay.underline ? 'underline' : '',
        overlay.strikethrough ? 'line-through' : '',
      ].filter(Boolean).join(' ') || 'none'
      return (
        <div
          key={overlay.id}
          style={{
            position: 'absolute',
            left: `${overlay.x}%`,
            top: `${overlay.y}%`,
            width: `${overlay.width}%`,
            fontFamily: overlay.fontFamily,
            fontSize: `${overlay.fontSize}px`,
            color: overlay.color,
            fontWeight: overlay.bold ? 700 : 400,
            fontStyle: overlay.italic ? 'italic' : 'normal',
            textDecoration,
            textAlign: overlay.textAlign,
            lineHeight: 1.3,
            display: 'flex',
            flexDirection: 'column',
            justifyContent,
            ...(overlay.height != null
              ? { height: `${overlay.height}%`, overflow: 'hidden' }
              : { minHeight: `${overlay.fontSize * 1.6}px` }),
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            textShadow: '0 1px 4px rgba(0,0,0,0.4)',
            padding: '2px 4px',
            pointerEvents: 'none',
          }}
        >
          {overlay.text}
        </div>
      )
    })
  }

  // No image or gradient: still show text overlays (e.g. template with missing asset URL).
  // In preview, never return null so the tile slot is visible in page-layout / design previews.
  if (!hasImage && !hasGradient) {
    if (hasTextOverlays) {
      return (
        <div className="w-full flex justify-center">
          <div
            className="relative w-full max-w-sm overflow-hidden bg-gray-100"
            style={{ aspectRatio: '9 / 16' }}
          >
            {renderTextOverlays()}
          </div>
        </div>
      )
    }
    return (
      <div className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">No greeting card content</p>
      </div>
    )
  }

  // Gradient-only card (no image)
  if (!hasImage && hasGradient) {
    return (
      <div className="w-full flex justify-center">
        <div
          className="relative w-full max-w-sm overflow-hidden"
          style={{ background: settings.backgroundGradient, aspectRatio: '9 / 16' }}
        >
          {renderTextOverlays()}
        </div>
      </div>
    )
  }

  // Image card (with optional text overlays).
  // imageFit defaults to 'cover' (fills frame, may crop sides) for back-compat
  // with cards designed in the 9:16 card editor. Auto-generated layouts pass
  // 'contain' so a user-uploaded card with a non-9:16 aspect isn't cropped.
  const fit = settings.imageFit === 'contain' ? 'contain' : 'cover'
  return (
    <div className="w-full flex justify-center">
      <div
        className="relative w-full max-w-sm overflow-hidden"
        style={{ aspectRatio: '9 / 16' }}
      >
        <img
          src={convertToCloudFrontUrl(settings.src!)}
          alt="Greeting card"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: fit, objectPosition: 'center center' }}
        />
        {renderTextOverlays()}
      </div>
    </div>
  )
}
