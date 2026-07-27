import React from 'react'
import { DesignTileSettings } from '@/lib/invite/schema'
import { convertToCloudFrontUrl } from '@/lib/image-utils'
import TextureOverlay from '@/components/invite/living-poster/TextureOverlay'

interface DesignTileSSRProps {
  settings: DesignTileSettings
  hasTitleOverlay?: boolean
}

/**
 * Server-safe version of DesignTile.
 * No client-side hooks. Renders a 9:16 card with image or gradient background
 * and static text overlays using absolute positioning.
 */
export default function DesignTileSSR({ settings }: DesignTileSSRProps) {
  const hasImage = !!settings.src
  const hasGradient = !!settings.backgroundGradient

  if (!hasImage && !hasGradient) {
    return null
  }

  const isFullBleed = settings.frameMode === 'full-bleed'
  const fullBleedAspectRatio = settings.aspectRatio || '4 / 5'
  const outerClassName = 'w-full flex justify-center'
  // Keep in sync with DesignTile.tsx (client) — same cap for the same reason,
  // so the server-rendered first paint and the client hydration agree and
  // there's no visible size jump when JS takes over.
  const boxClassName = isFullBleed ? 'relative w-full max-w-4xl overflow-hidden' : 'relative w-full max-w-sm overflow-hidden'
  const boxStyle = isFullBleed ? { aspectRatio: fullBleedAspectRatio } : { aspectRatio: '9 / 16' }

  const renderTextOverlays = () => {
    if (!settings.textOverlays || settings.textOverlays.length === 0) return null
    return settings.textOverlays.map((overlay) => {
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

  const heroTexture = settings.texture && settings.texture.type !== 'none' && (
    <TextureOverlay
      type={settings.texture.type}
      intensity={settings.texture.intensity}
      imageUrl={settings.texture.imageUrl}
      textureBlend={settings.texture.textureBlend}
    />
  )

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

  // Mirror GreetingCardTile.tsx: 'contain' lets auto-generated cards with
  // off-9:16 aspects render without side-cropping the title.
  const fit = settings.imageFit === 'contain' ? 'contain' : 'cover'
  return (
    <div className={outerClassName}>
      <div className={boxClassName} style={boxStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={convertToCloudFrontUrl(settings.src!)}
          alt="Greeting card"
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
