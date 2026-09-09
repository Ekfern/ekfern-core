'use client'

import React, { useRef } from 'react'
import { ImagePlus } from 'lucide-react'
import { PosterTileSettings } from '@/lib/invite/schema'
import { convertToCloudFrontUrl } from '@/lib/image-utils'
import TextureOverlay from '@/components/invite/render/TextureOverlay'
import { INVITE_HERO_MAX_HEIGHT, INVITE_HERO_MAX_WIDTH } from '@/components/invite/render/inviteMediaSizes'
import { useInviteViewport } from '@/components/invite/render/useInviteViewport'

export interface PosterTileProps {
  settings: PosterTileSettings
  preview?: boolean
}

export default function PosterTile({ settings, preview: _preview = false }: PosterTileProps) {
  // The print is sized against the surface it is on, so it has to measure that
  // surface the way the map and the gallery do. Without this the caps fall
  // through to `100vw` / `100svh` - the browser window - which is right on a
  // real invitation and wrong inside the editor's phone mockup, where the tile
  // would size itself to the window around the mockup rather than to the
  // mockup. That is the whole reason the hook exists.
  const surfaceRef = useRef<HTMLDivElement>(null)
  useInviteViewport(surfaceRef)

  const hasImage = !!settings.src
  const hasGradient = !!settings.backgroundGradient
  const hasTextOverlays = settings.textOverlays && settings.textOverlays.length > 0
  const isFullBleed = settings.frameMode === 'full-bleed'
  const fullBleedAspectRatio = settings.aspectRatio || '4 / 5'
  const outerClassName = 'w-full flex justify-center'
  // The print centres differently: its box must shrink-wrap the picture, and a
  // shrink-wrapping box has to be an inline-block rather than a flex item, so
  // this one centres with text-align instead of justify-content.
  const printOuterClassName = 'w-full text-center'
  // A box with a declared aspect ratio, for the cases that have no picture of
  // their own to take one from: the gradient card, and the empty slot. An
  // uploaded photograph does not go in here - see `renderHeroImage`.
  const boxClassName = isFullBleed ? 'relative w-full max-w-2xl overflow-hidden' : 'relative w-full max-w-sm overflow-hidden'
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

  // A full-bleed poster is a print of whatever was uploaded, so the picture
  // decides its own shape.
  //
  // It used to be poured into a declared box - 4:5 by default - and cropped to
  // `cover`. A 3024x1964 screenshot is 1.54 wide; filling a 0.8 box with it cut
  // 48% of the picture away, and no setting on the tile could have said
  // otherwise, because the crop came from the box rather than the file. Here
  // the image sizes itself under two caps and the wrapper shrink-wraps to what
  // it becomes, so there is nothing left to crop and no letterbox either.
  //
  // Overlays stay in percentages of this wrapper, which is now exactly the
  // rendered picture - the coordinate system they were authored against.
  if (isFullBleed) {
    return (
      <div ref={surfaceRef} className={printOuterClassName}>
        {/* inline-block, not a flex item: a flex item is sized by max-content,
            which is the width the picture would take at its max-height and
            ignores its max-width entirely - so the box came out 1047px wide
            around an 860px image and left it flush left, 93px off centre. An
            inline-block shrink-wraps instead, but its shrink-to-fit width is
            still the picture's width at its max-height, so the box carries the
            same width cap as the image: under either cap the two agree, the box
            is exactly the picture, and `text-align: center` centres it. */}
        <div className="relative inline-block align-top" style={{ maxWidth: INVITE_HERO_MAX_WIDTH }}>
          <img
            src={convertToCloudFrontUrl(settings.src!)}
            alt="Poster"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="block"
            style={{
              maxWidth: INVITE_HERO_MAX_WIDTH,
              maxHeight: INVITE_HERO_MAX_HEIGHT,
              width: 'auto',
              height: 'auto',
            }}
          />
          {heroTexture}
          {renderTextOverlays()}
        </div>
      </div>
    )
  }

  // The small inset card keeps its 9:16 frame: it is a postcard, a shape the
  // design chose, not a print of a photograph.
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
