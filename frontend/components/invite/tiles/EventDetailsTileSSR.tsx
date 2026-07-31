import React from 'react'
import { MapPin } from 'lucide-react'
import { EventDetailsTileSettings } from '@/lib/invite/schema'
import { getTimezoneLabel } from '@/lib/invite/timezone'
import { getAutomaticLabelColor } from '@/lib/invite/colorUtils'
import { isValidMapUrl, getEmbedUrl, canShowMap, generateMapUrlFromLocation, generateMapUrlFromCoordinates } from '@/lib/invite/mapUtils'
import { BUTTON_CSS, getButtonStyles } from '@/lib/invite/buttonStyles'

// Border style configurations (duplicated from EventDetailsTile for SSR)
const BORDER_STYLES = {
  elegant: {
    symbol: '❦',
    lineStyle: 'gradient',
    showSymbol: true,
  },
  minimal: {
    symbol: '',
    lineStyle: 'solid',
    showSymbol: false,
  },
  ornate: {
    symbol: '✿',
    lineStyle: 'gradient',
    showSymbol: true,
  },
  modern: {
    symbol: '•',
    lineStyle: 'dotted',
    showSymbol: true,
  },
  classic: {
    symbol: '',
    lineStyle: 'double',
    showSymbol: false,
  },
  vintage: {
    symbol: '✦',
    lineStyle: 'gradient',
    showSymbol: true,
  },
  none: {
    symbol: '',
    lineStyle: 'none',
    showSymbol: false,
  },
} as const

function renderDecorativeBorder(
  style: string,
  color: string,
  width: number,
  customSymbol?: string
) {
  const borderConfig = BORDER_STYLES[style as keyof typeof BORDER_STYLES] || BORDER_STYLES.elegant
  const symbol = customSymbol !== undefined ? customSymbol : borderConfig.symbol
  
  if (style === 'none') {
    return null
  }
  
  // Render based on line style
  if (borderConfig.lineStyle === 'gradient') {
    return (
      <div className="flex items-center justify-center">
        <div 
          className="flex-1 h-px bg-gradient-to-r from-transparent via-current to-transparent"
          style={{ 
            color,
            height: `${width}px`,
          }}
        />
        {borderConfig.showSymbol && symbol && (
          <div 
            className="mx-4 text-2xl"
            style={{ color }}
          >
            {symbol}
          </div>
        )}
        <div 
          className="flex-1 h-px bg-gradient-to-r from-transparent via-current to-transparent"
          style={{ 
            color,
            height: `${width}px`,
          }}
        />
      </div>
    )
  }
  
  if (borderConfig.lineStyle === 'solid') {
    return (
      <div className="flex items-center justify-center">
        <div 
          className="flex-1"
          style={{ 
            borderTop: `${width}px solid ${color}`,
          }}
        />
      </div>
    )
  }
  
  if (borderConfig.lineStyle === 'dotted') {
    return (
      <div className="flex items-center justify-center">
        <div 
          className="flex-1 h-px border-t-2 border-dotted"
          style={{ 
            borderColor: color,
            borderTopWidth: `${width}px`,
          }}
        />
        {borderConfig.showSymbol && symbol && (
          <div 
            className="mx-4 text-2xl"
            style={{ color }}
          >
            {symbol}
          </div>
        )}
        <div 
          className="flex-1 h-px border-t-2 border-dotted"
          style={{ 
            borderColor: color,
            borderTopWidth: `${width}px`,
          }}
        />
      </div>
    )
  }
  
  if (borderConfig.lineStyle === 'double') {
    return (
      <div className="flex items-center justify-center">
        <div 
          className="flex-1"
          style={{ 
            borderTop: `${width}px double ${color}`,
          }}
        />
      </div>
    )
  }
  
  return null
}

interface EventDetailsTileSSRProps {
  settings: EventDetailsTileSettings
  eventSlug?: string
  eventTitle?: string
  eventDate?: string
  eventTimezone?: string
}

/**
 * Server-safe version of EventDetailsTile
 * Renders date, time, location, dress code, and "Save the Date" button
 * No useState for calendar menu (can be added client-side after hydration)
 */
export default function EventDetailsTileSSR({ 
  settings, 
  eventSlug, 
  eventTitle, 
  eventDate,
  eventTimezone
}: EventDetailsTileSSRProps) {
  const tz = eventTimezone || 'Asia/Kolkata'
  const formatDate = (dateString: string) => {
    try {
      let date: Date
      // Handle date-only strings (YYYY-MM-DD) as local dates to avoid timezone issues
      if (dateString.includes('T')) {
        // ISO datetime string
        date = new Date(dateString)
      } else {
        // Date-only string (YYYY-MM-DD), parse as local date
        const [year, month, day] = dateString.split('-').map(Number)
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
          return dateString
        }
        date = new Date(year, month - 1, day)
      }
      
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  const formatTime = (timeString: string) => {
    if (!timeString) return timeString

    const [hours, minutes] = timeString.split(':').map(Number)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return timeString
    const hour12 = ((hours + 11) % 12) + 1
    const ampm = hours >= 12 ? 'PM' : 'AM'
    return `${hour12}:${String(minutes).padStart(2, '0')} ${ampm} ${getTimezoneLabel(tz)}`
  }

  // Save the Date button styling — shares the same variant system as FeatureButtonsTile
  const buttonColor = settings.buttonColor || 'var(--theme-primary, #1F2937)'
  const buttonVariant = settings.buttonVariant ?? 'classic'
  const buttonRadius = settings.buttonRadius ?? 'round'
  const { extraClass: btnExtraClass, style: btnStyle } = getButtonStyles(buttonColor, buttonVariant, buttonRadius)

  const labelColor = getAutomaticLabelColor(settings.fontColor)
  const fontColor = settings.fontColor || 'var(--theme-fg, #1F2937)'

  // Get border settings with defaults
  const borderStyle = settings.borderStyle || 'elegant'
  const borderColor = settings.borderColor || 'var(--theme-muted, #D1D5DB)'
  const borderWidth = settings.borderWidth || 1
  const decorativeSymbol = settings.decorativeSymbol
  const backgroundColor = settings.backgroundColor
  const borderRadius = settings.borderRadius ?? 0
  const textAlign = settings.textAlign || 'center'
  const textAlignClass = textAlign === 'left' ? 'text-left' : textAlign === 'right' ? 'text-right' : 'text-center'
  const marginClass = textAlign === 'left' ? 'mr-auto' : textAlign === 'right' ? 'ml-auto' : 'mx-auto'
  const justifyClass = textAlign === 'left' ? 'justify-start' : textAlign === 'right' ? 'justify-end' : 'justify-center'
  const buttonJustifyStyle = textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center'

  const isGlass = borderStyle === 'glass'
  const topBorder = isGlass ? null : renderDecorativeBorder(borderStyle, borderColor, borderWidth, decorativeSymbol)
  const bottomBorder = isGlass ? null : renderDecorativeBorder(borderStyle, borderColor, borderWidth, decorativeSymbol)

  const wrapperStyle: React.CSSProperties = isGlass
    ? {
        backgroundColor: 'rgba(255,255,255,0.12)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.28)',
        boxShadow: '0 0 120px 40px rgba(255,255,255,0.12), 0 20px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.25)',
        borderRadius: `${borderRadius || 24}px`,
        maxWidth: '420px',
        marginLeft: 'auto',
        marginRight: 'auto',
      }
    : {
        backgroundColor: backgroundColor || 'transparent',
        borderRadius: `${borderRadius}px`,
      }

  return (
    <div
      className={`w-full pt-8 pb-4 px-6 ${textAlignClass}`}
      style={wrapperStyle}
    >
      <div className={`max-w-2xl ${marginClass}`}>
        {/* Decorative top border */}
        {topBorder && (
          <div className="mb-6">
            {topBorder}
          </div>
        )}

        <div className="space-y-6" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
          {settings.date && (
            <div className="space-y-2">
              <div
                className="text-xs uppercase tracking-widest font-light italic mb-3"
                style={{ color: labelColor, fontFamily: settings.headerFontFamily }}
              >
                Date
              </div>
              <div
                className="text-xl md:text-2xl font-normal leading-relaxed"
                style={{ color: fontColor, fontFamily: settings.contentFontFamily }}
              >
                {formatDate(settings.date)}
              </div>
            </div>
          )}

          {settings.time && (
            <div className="space-y-2">
              <div
                className="text-xs uppercase tracking-widest font-light italic mb-3"
                style={{ color: labelColor, fontFamily: settings.headerFontFamily }}
              >
                Time
              </div>
              <div
                className="text-xl md:text-2xl font-normal leading-relaxed"
                style={{ color: fontColor, fontFamily: settings.contentFontFamily }}
              >
                {formatTime(settings.time)}
              </div>
            </div>
          )}

          {settings.location && (() => {
            // Determine map URL - prioritize coordinates, then mapUrl
            let mapUrl = settings.mapUrl
            if (settings.coordinates) {
              mapUrl = generateMapUrlFromCoordinates(settings.coordinates.lat, settings.coordinates.lng)
            }
            
            // Check if map can be shown (location must be verified)
            const canDisplay = canShowMap(settings)
            
            return (
              <div className="space-y-2">
                <div
                  className="text-xs uppercase tracking-widest font-light italic mb-3"
                  style={{ color: labelColor, fontFamily: settings.headerFontFamily }}
                >
                  Location
                </div>
                <div
                  className={`text-xl md:text-2xl font-normal leading-relaxed flex items-center ${justifyClass} gap-2`}
                  style={{ color: fontColor, fontFamily: settings.contentFontFamily }}
                >
                  <span>{settings.location}</span>
                  {canDisplay && mapUrl && (
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-gray-100 transition-colors ml-2"
                      aria-label="Open location in maps"
                    >
                      <MapPin className="w-4 h-4 text-gray-600" />
                    </a>
                  )}
                </div>
                
                {/* Embedded Map - only show if verified, enabled, and valid */}
                {canDisplay && settings.showMap && mapUrl && isValidMapUrl(mapUrl) && (() => {
                  const embedUrl = getEmbedUrl(mapUrl, settings.coordinates, settings.mapZoom)
                  
                  if (embedUrl) {
                    // Get border settings to match tile styling
                    const mapBackgroundColor = settings.backgroundColor || '#FFFFFF'
                    const mapBorderRadius = settings.borderRadius ?? 8
                    
                    return (
                      <div className="mt-6">
                        {/* Map container with enhanced styling */}
                        <div 
                          className="w-full rounded-xl overflow-hidden"
                          style={{
                            border: `${borderWidth * 2}px solid ${borderColor}`,
                            borderRadius: `${mapBorderRadius}px`,
                            backgroundColor: mapBackgroundColor,
                            boxShadow: `0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)`,
                          }}
                        >
                          <div className="relative">
                            <iframe
                              key={`map-${settings.mapZoom ?? 15}-${embedUrl}`}
                              src={embedUrl}
                              width="100%"
                              height="400"
                              style={{ border: 0 }}
                              allowFullScreen
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                              title="Event location map"
                              className="w-full"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  }
                  
                  // If URL is valid but not embeddable (e.g., Apple Maps, short links), show helpful message
                  return (
                    <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
                      <p className="text-xs text-gray-600 text-center">
                        Map preview not available for this link type. 
                        <a 
                          href={mapUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline ml-1"
                        >
                          Open in maps
                        </a>
                      </p>
                    </div>
                  )
                })()}
              </div>
            )
          })()}

          {settings.dressCode && (
            <div className="space-y-2">
              <div
                className="text-xs uppercase tracking-widest font-light italic mb-3"
                style={{ color: labelColor, fontFamily: settings.headerFontFamily }}
              >
                Dress Code
              </div>
              <div
                className="text-xl md:text-2xl font-normal leading-relaxed italic"
                style={{ color: fontColor, fontFamily: settings.contentFontFamily }}
              >
                {settings.dressCode}
              </div>
            </div>
          )}
        </div>

        {/* Decorative bottom border */}
        {bottomBorder && (
          <div className="mt-6 mb-4">
            {bottomBorder}
          </div>
        )}
      
        {/* Save the Date Button - SSR version with direct link to ICS */}
        <style dangerouslySetInnerHTML={{ __html: BUTTON_CSS }} />
        <div className="relative mt-4 flex" style={{ justifyContent: buttonJustifyStyle }}>
          {eventSlug ? (
            <a
              href={`/api/ics?slug=${eventSlug}`}
              className={`inline-block px-8 py-3 focus:outline-none focus:ring-2 focus:ring-offset-2 ${btnExtraClass}`}
              style={{ ...btnStyle, minHeight: '44px' }}
            >
              Save the Date
            </a>
          ) : (
            <button
              className={`px-8 py-3 focus:outline-none focus:ring-2 focus:ring-offset-2 ${btnExtraClass}`}
              style={{ ...btnStyle, minHeight: '44px' }}
            >
              Save the Date
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
