'use client'

import React from 'react'
import { ImagePlus } from 'lucide-react'
import { PosterTileSettings } from '@/lib/invite/schema'
import { convertToCloudFrontUrl } from '@/lib/image-utils'
import TextureOverlay from '@/components/invite/render/TextureOverlay'

export interface PosterTileProps {
  settings: PosterTileSettings
  preview?: boolean
}

export default function PosterTile({ settings, preview: _preview = false }: PosterTileProps) {
  const hasImage = !!settings.src
  const hasGradient = !!settings.backgroundGradient
  const hasTextOverlays = settings.textOverlays && settings.textOverlays.length > 0
  const isFullBleed = settings.frameMode === 'full-bleed'
  const fullBleedAspectRatio = settings.aspectRatio || '4 / 5'
  const outerClassName = 'w-full flex justify-center'
  // Full-bleed has no width cap on its own — on a wide desktop window it would
  // stretch edge to edge and, since it keeps its aspect ratio, get extremely
  // tall with it (a 4:5 hero at 1920px wide is 2400px tall). max-w-4xl keeps
  // it clearly bigger than the ~672px text column below (max-w-2xl on the
  // other tiles) so it still reads as the bold hero moment, without the
  // runaway height on large screens. Mobile is unaffected — phone widths
  // never approach this cap.
  const boxClassName = isFullBleed ? 'relative w-full max-w-4xl overflow-hidden' : 'relative w-full max-w-sm overflow-hidden'
  const boxStyle = isFullBleed ? { aspectRatio: fullBleedAspectRatio } : { aspectRatio: '9 / 16' }

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
            textShadow:
              (overlay.shadowBlur ?? 4) === 0
                ? 'none'
                : `${overlay.shadowX ?? 0}px ${overlay.shadowY ?? 1}px ${overlay.shadowBlur ?? 4}px ${overlay.shadowColor ?? '#000000'}${Math.round((overlay.shadowOpacity ?? 0.8) * 255)
                  .toString(16)
                  .padStart(2, '0')}`,
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
        <div className={outerClassName}>
          <div className={`${boxClassName} bg-gray-100`} style={boxStyle}>
            {renderTextOverlays()}
          </div>
        </div>
      )
    }
    return (
      <div className={outerClassName}>
        <div
          className={`${boxClassName} flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 ${isFullBleed ? '' : 'rounded-xl'} bg-gray-50`}
          style={boxStyle}
        >
          <ImagePlus className="w-10 h-10 text-gray-400" aria-hidden />
          <p className="text-gray-500 text-sm font-medium">Add your design</p>
        </div>
      </div>
    )
  }

  const heroTexture = settings.texture && settings.texture.type !== 'none' && (
    <TextureOverlay
      type={settings.texture.type}
      intensity={settings.texture.intensity}
      imageUrl={settings.texture.imageUrl}
      textureBlend={settings.texture.textureBlend}
    />
  )

  // Gradient-only card (no image)
  if (!hasImage && hasGradient) {
    return (
      <div className={outerClassName}>
        <div className={boxClassName} style={{ ...boxStyle, background: settings.backgroundGradient }}>
          {heroTexture}
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
    <div className={outerClassName}>
      <div className={boxClassName} style={boxStyle}>
        <img
          src={convertToCloudFrontUrl(settings.src!)}
          alt="Poster"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: fit, objectPosition: 'center center' }}
        />
        {heroTexture}
        {renderTextOverlays()}
      </div>
    </div>
  )
}
