'use client'

import React, { useState } from 'react'
import { MapPin, ChevronDown, Calendar, Download } from 'lucide-react'
import { EventDetailsTileSettings } from '@/lib/invite/schema'
import { getTimezoneLabel } from '@/lib/invite/timezone'
import { getGoogleCalendarHref } from '@/lib/calendar'
import { getAutomaticLabelColor } from '@/lib/invite/colorUtils'
import { BUTTON_CSS, getButtonStyles } from '@/lib/invite/buttonStyles'

export interface EventDetailsTileProps {
  settings: EventDetailsTileSettings
  preview?: boolean
  eventSlug?: string
  eventTitle?: string
  eventDate?: string
  eventTimezone?: string
}

// Border style configurations
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

export default function EventDetailsTile({ settings, preview = false, eventSlug, eventTitle, eventDate, eventTimezone }: EventDetailsTileProps) {
  const [showCalendarMenu, setShowCalendarMenu] = useState(false)
  const tz = eventTimezone || 'Asia/Kolkata'

  // Save the Date button styling — shares the same variant system as FeatureButtonsTile
  // so every layout's CTAs look consistent instead of a fixed hardcoded outline.
  // Kept identical to FeatureButtonsTile on purpose: one invitation should not
  // have two button shapes. #D4A017 is the real --theme-primary default; the
  // #1F2937 that used to sit here was a near-black that matched nothing.
  const buttonColor = settings.buttonColor || 'var(--theme-primary, #D4A017)'
  const buttonVariant = settings.buttonVariant ?? 'classic'
  const buttonRadius = settings.buttonRadius ?? 'var(--radius-control)'
  const { extraClass: btnExtraClass, style: btnStyle } = getButtonStyles(buttonColor, buttonVariant, buttonRadius)
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

  const parseDateParts = (dateString: string): { day: number; weekday: string; month: string; year: number } | null => {
    try {
      let date: Date
      if (dateString.includes('T')) {
        date = new Date(dateString)
      } else {
        const [year, month, day] = dateString.split('-').map(Number)
        if (isNaN(year) || isNaN(month) || isNaN(day)) return null
        date = new Date(year, month - 1, day)
      }
      return {
        day: date.getDate(),
        weekday: date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(),
        month: date.toLocaleDateString('en-US', { month: 'long' }).toUpperCase(),
        year: date.getFullYear(),
      }
    } catch {
      return null
    }
  }

  const handleSaveTheDate = (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault()
    e?.stopPropagation()
    setShowCalendarMenu(!showCalendarMenu)
  }

  const handleGoogleCalendar = (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault()
    e?.stopPropagation()
    const dateToUse = settings.date || eventDate
    if (dateToUse) {
      let startDate: Date
      try {
        if (dateToUse.includes('T')) {
          startDate = new Date(dateToUse)
        } else {
          const [year, month, day] = dateToUse.split('-').map(Number)
          startDate = new Date(year, month - 1, day)
        }

        // Add time if available
        if (settings.time) {
          const [hours, minutes] = settings.time.split(':').map(Number)
          if (!isNaN(hours) && !isNaN(minutes)) {
            startDate.setHours(hours, minutes || 0, 0, 0)
          }
        } else {
          startDate.setHours(0, 0, 0, 0)
        }

        const endDate = new Date(startDate.getTime() + 4 * 60 * 60 * 1000) // 4 hours later

        const googleUrl = getGoogleCalendarHref({
          title: eventTitle || 'Event',
          startISO: startDate.toISOString(),
          endISO: endDate.toISOString(),
        })

        window.open(googleUrl, '_blank')
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error creating calendar event:', error)
        }
      }
    }
    setShowCalendarMenu(false)
  }

  const handleDownloadICS = (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault()
    e?.stopPropagation()
    if (eventSlug) {
      window.open(`/api/ics?slug=${eventSlug}`, '_blank')
    }
    setShowCalendarMenu(false)
  }

  if (preview) {
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
    const dropdownPositionClass = textAlign === 'left' ? 'left-0' : textAlign === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'

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
          borderRadius: borderRadius ? `${borderRadius}px` : 'var(--radius-surface)',
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
        className={`w-full py-12 px-6 ${textAlignClass}`}
        style={wrapperStyle}
      >
        <div className={`max-w-2xl ${marginClass}`}>
          {/* Decorative top border */}
          {topBorder && (
            <div className="mb-8">
              {topBorder}
            </div>
          )}

          {(() => {
            const labelColor = getAutomaticLabelColor(settings.fontColor)
            const fontColor = settings.fontColor || 'var(--theme-fg, #1F2937)'
            const dateLayout = settings.dateLayout || 'single-line'

            if (dateLayout === 'day-prominent' && settings.date) {
              const parts = parseDateParts(settings.date)
              if (parts) {
                return (
                  <div className="space-y-8" style={{ fontFamily: 'var(--theme-font-body, Georgia, serif)' }}>
                    <div className="space-y-4">
                      <div
                        className="text-4xl md:text-5xl lg:text-6xl font-bold leading-none tracking-tight"
                        style={{ color: fontColor, fontFamily: settings.contentFontFamily }}
                      >
                        {parts.day}
                      </div>
                      <div
                        className="text-sm md:text-base uppercase tracking-widest font-medium"
                        style={{ color: fontColor, fontFamily: settings.contentFontFamily }}
                      >
                        {parts.weekday}
                        {settings.time && ` · ${formatTime(settings.time)}`}
                      </div>
                      <div
                        className="text-sm md:text-base uppercase tracking-widest"
                        style={{ color: fontColor, fontFamily: settings.contentFontFamily }}
                      >
                        {parts.month} {parts.year}
                      </div>
                    </div>
                    {settings.location && (() => {
                      return (
                        <div className="space-y-2">
                          <div
                            className={`text-xl md:text-2xl font-normal leading-relaxed flex items-center ${justifyClass} gap-2`}
                            style={{ color: fontColor, fontFamily: settings.contentFontFamily }}
                          >
                            <span>{settings.location}</span>
                          </div>
                        </div>
                      )
                    })()}
                    {/* Save the Date button for day-prominent - rendered below in shared section */}
                  </div>
                )
              }
            }

            return (
              <div className="space-y-8" style={{ fontFamily: 'var(--theme-font-body, Georgia, serif)' }}>
                {settings.date && (
                  <div className="space-y-2">
                    <div
                      className="text-xs uppercase tracking-widest font-light italic mb-3"
                      style={{
                        color: labelColor,
                        fontFamily: settings.headerFontFamily,
                      }}
                    >
                      Date
                    </div>
                    <div
                      className="text-xl md:text-2xl font-normal leading-relaxed"
                      style={{
                        color: fontColor,
                        fontFamily: settings.contentFontFamily,
                      }}
                    >
                      {formatDate(settings.date)}
                    </div>
                  </div>
                )}
                {settings.time && (
                  <div className="space-y-2">
                    <div
                      className="text-xs uppercase tracking-widest font-light italic mb-3"
                      style={{
                        color: labelColor,
                        fontFamily: settings.headerFontFamily,
                      }}
                    >
                      Time
                    </div>
                    <div
                      className="text-xl md:text-2xl font-normal leading-relaxed"
                      style={{
                        color: fontColor,
                        fontFamily: settings.contentFontFamily,
                      }}
                    >
                      {formatTime(settings.time)}
                    </div>
                  </div>
                )}
                {settings.location && (() => {

                  return (
                    <div className="space-y-2">
                      <div
                        className="text-xs uppercase tracking-widest font-light italic mb-3"
                        style={{
                          color: labelColor,
                          fontFamily: settings.headerFontFamily,
                        }}
                      >
                        Location
                      </div>
                      <div
                        className={`text-xl md:text-2xl font-normal leading-relaxed flex items-center ${justifyClass} gap-2`}
                        style={{
                          color: fontColor,
                          fontFamily: settings.contentFontFamily,
                        }}
                      >
                        <span>{settings.location}</span>
                      </div>

                      {/* Embedded Map - only show if verified, enabled, and valid */}
                    </div>
                  )
                })()}

                {settings.dressCode && (
                  <div className="space-y-2">
                    <div
                      className="text-xs uppercase tracking-widest font-light italic mb-3"
                      style={{
                        color: labelColor,
                        fontFamily: settings.headerFontFamily,
                      }}
                    >
                      Dress Code
                    </div>
                    <div
                      className="text-xl md:text-2xl font-normal leading-relaxed italic"
                      style={{
                        color: fontColor,
                        fontFamily: settings.contentFontFamily,
                      }}
                    >
                      {settings.dressCode}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Decorative bottom border */}
          {bottomBorder && (
            <div className="mt-10 mb-8">
              {bottomBorder}
            </div>
          )}

          {/* Save the Date Button */}
          <style dangerouslySetInnerHTML={{ __html: BUTTON_CSS }} />
          <div className="relative mt-8 flex" style={{ justifyContent: textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center' }}>
            <button
              type="button"
              onClick={handleSaveTheDate}
              className={`px-8 py-3 focus:outline-none focus:ring-2 focus:ring-offset-2 ${btnExtraClass}`}
              style={{ ...btnStyle, minHeight: '44px' }}
              aria-expanded={showCalendarMenu}
              aria-haspopup="true"
            >
              Save the Date
              <ChevronDown
                className={`w-4 h-4 inline-block ml-2 transition-transform ${showCalendarMenu ? 'rotate-180' : ''}`}
              />
            </button>

            {showCalendarMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowCalendarMenu(false)}
                />
                <div
                  className={`absolute top-full ${dropdownPositionClass} mt-2 z-20 rounded-sm overflow-hidden shadow-xl backdrop-blur-md min-w-[200px] border border-gray-200`}
                  style={{
                    backgroundColor: `rgba(255, 255, 255, 0.95)`,
                  }}
                >
                  <button
                    type="button"
                    onClick={handleGoogleCalendar}
                    className="w-full px-4 py-3 text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100 flex items-center gap-3 text-gray-800 font-light"
                  >
                    <Calendar className="w-5 h-5" />
                    <span>Add to Google Calendar</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadICS}
                    className="w-full px-4 py-3 text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100 flex items-center gap-3 border-t border-gray-200 text-gray-800 font-light"
                  >
                    <Download className="w-5 h-5" />
                    <span>Download .ics file</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  const fontColor = settings.fontColor || 'var(--theme-fg, #374151)' // Default to gray-700 equivalent
  const labelColor = getAutomaticLabelColor(settings.fontColor)

  // Get border settings with defaults for non-preview mode
  const borderStyle = settings.borderStyle || 'elegant'
  const borderColor = settings.borderColor || 'var(--theme-muted, #E5E7EB)'
  const borderWidth = settings.borderWidth || 1
  const borderRadius = settings.borderRadius ?? 4
  const backgroundColor = settings.backgroundColor || '#F9FAFB'

  // Apply conditional border classes
  const borderClasses =
    borderStyle === 'none'
      ? ''
      : borderStyle === 'classic'
        ? 'border-2'
        : 'border'

  return (
    <div
      className={`w-full py-6 px-4 ${borderClasses}`}
      style={{
        borderRadius: `${borderRadius}px`,
        borderWidth: borderStyle === 'none' ? '0' : borderStyle === 'classic' ? '2px' : `${borderWidth}px`,
        borderColor: borderStyle === 'none' ? 'transparent' : borderColor,
        backgroundColor,
      }}
    >
      <div className="space-y-3 text-sm" style={{ fontFamily: 'var(--theme-font-body, Georgia, serif)' }}>
        {settings.date && (
          <p>
            <span
              className="text-xs uppercase tracking-widest font-light italic mr-2"
              style={{
                color: labelColor,
                fontFamily: settings.headerFontFamily,
              }}
            >
              Date:
            </span>
            <span
              className="font-normal"
              style={{
                color: fontColor,
                fontFamily: settings.contentFontFamily,
              }}
            >
              {formatDate(settings.date)}
            </span>
          </p>
        )}
        {settings.time && (
          <p>
            <span
              className="text-xs uppercase tracking-widest font-light italic mr-2"
              style={{
                color: labelColor,
                fontFamily: settings.headerFontFamily,
              }}
            >
              Time:
            </span>
            <span
              className="font-normal"
              style={{
                color: fontColor,
                fontFamily: settings.contentFontFamily,
              }}
            >
              {formatTime(settings.time)}
            </span>
          </p>
        )}
        {settings.location && (() => {

          return (
            <div>
              <p>
                <span
                  className="text-xs uppercase tracking-widest font-light italic mr-2"
                  style={{
                    color: labelColor,
                    fontFamily: settings.headerFontFamily,
                  }}
                >
                  Location:
                </span>
                <span
                  className="font-normal"
                  style={{
                    color: fontColor,
                    fontFamily: settings.contentFontFamily,
                  }}
                >
                  {settings.location}
                </span>
              </p>

              {/* Embedded Map - only show if verified, enabled, and valid */}
            </div>
          )
        })()}
        {settings.dressCode && (
          <p>
            <span
              className="text-xs uppercase tracking-widest font-light italic mr-2"
              style={{
                color: labelColor,
                fontFamily: settings.headerFontFamily,
              }}
            >
              Dress Code:
            </span>
            <span
              className="font-normal italic"
              style={{
                color: fontColor,
                fontFamily: settings.contentFontFamily,
              }}
            >
              {settings.dressCode}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}

