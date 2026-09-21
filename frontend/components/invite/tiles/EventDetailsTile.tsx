'use client'

import React, { useState } from 'react'
import { MapPin, ChevronDown, Calendar, Download } from 'lucide-react'
import { recipe } from '@/lib/invite/recipes'
import { surface } from '@/lib/invite/surfaces'
import { EventDetailsTileSettings } from '@/lib/invite/schema'
import { formatEventTime, zonedTimeToUtc } from '@/lib/invite/timezone'
import { getGoogleCalendarHref } from '@/lib/calendar'
import { BUTTON_CSS, getButtonStyles } from '@/lib/invite/buttonStyles'
import { usePageDesign } from '@/components/invite/render/AppearanceProvider'

export interface EventDetailsTileProps {
  settings: EventDetailsTileSettings
  preview?: boolean
  eventSlug?: string
  eventTitle?: string
  eventDate?: string
  eventTimezone?: string
  /** Its own id, so the page can single this card out under `featured`. */
  tileId?: string
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

export default function EventDetailsTile({ settings, preview = false, eventSlug, eventTitle, eventDate, eventTimezone, tileId }: EventDetailsTileProps) {
  const [showCalendarMenu, setShowCalendarMenu] = useState(false)
  // No fallback. An invitation that does not know its zone prints no zone,
  // rather than telling a Chicago guest their event is in IST.
  const tz = eventTimezone
  // Which abbreviation applies depends on the date - America/Chicago is CST in
  // January and CDT in July - so the label is resolved against the event day.
  const zoneLabelDate = (() => {
    const d = settings.date || eventDate
    if (!d) return undefined
    const parsed = new Date(`${String(d).slice(0, 10)}T12:00:00Z`)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  })()

  // Save the Date button styling — shares the same variant system as FeatureButtonsTile
  // so every layout's CTAs look consistent instead of a fixed hardcoded outline.
  // Kept identical to FeatureButtonsTile on purpose: one invitation should not
  // have two button shapes. #D4A017 is the real --theme-primary default; the
  // #1F2937 that used to sit here was a near-black that matched nothing.
  const buttonColor = 'var(--theme-primary)'
  const pageDesign = usePageDesign()
  // The page decides how buttons look, so Save the Date and the RSVP buttons
  // cannot end up drawn differently. A tile may still override it.
  // Both come from the invitation. A Save the Date drawn differently from the
  // RSVP beside it was never a decision anyone made; it was two tiles each
  // carrying their own answer.
  const buttonVariant = pageDesign?.buttonStyle ?? 'classic'
  const buttonRadius = 'var(--radius-control)'
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

  // Deliberately not a conversion: the guest is shown the time on the wall at
  // the venue, which is the number the hosts will say. Converting to the
  // reader's own zone is the calendar's job, below.
  const formatTime = (timeString: string) =>
    formatEventTime(timeString, tz, zoneLabelDate)

  const ordinalSuffix = (day: number) => {
    const teens = day % 100
    if (teens >= 11 && teens <= 13) return 'th'
    switch (day % 10) {
      case 1: return 'st'
      case 2: return 'nd'
      case 3: return 'rd'
      default: return 'th'
    }
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
    setShowCalendarMenu(false)

    const dateToUse = settings.date || eventDate
    if (!dateToUse || !tz) return

    // The host typed a wall clock at the venue. Turning it into a moment needs
    // the event's zone - the previous code used `new Date(y, m, d)` and
    // `setHours`, both of which read the *guest's* browser zone, so the same
    // invitation produced a different instant for every guest who tapped it.
    const startDate = zonedTimeToUtc(dateToUse, settings.time, tz)
    if (!startDate) return

    // No end time exists on the tile yet, so assume four hours.
    const endDate = new Date(startDate.getTime() + 4 * 60 * 60 * 1000)

    // The public invitation, deliberately without the `?g=` token the guest is
    // reading under - a calendar entry gets forwarded, and a personal token
    // should not travel with it.
    const inviteUrl = eventSlug ? `${window.location.origin}/invite/${eventSlug}` : undefined

    window.open(
      getGoogleCalendarHref({
        title: eventTitle || 'Event',
        location: settings.location || undefined,
        url: inviteUrl,
        startISO: startDate.toISOString(),
        endISO: endDate.toISOString(),
      }),
      '_blank',
    )
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
    // Colour and width come from the invitation. All eight border styles stay -
    // they are what the card *is* - but an ornate rule in an arbitrary hex was
    // a second opinion about the palette.
    const borderColor = 'var(--theme-muted)'
    const borderWidth = 1
    const decorativeSymbol = pageDesign?.dividerSymbol || '\u2766'
    const textAlign = settings.textAlign || 'center'
    const textAlignClass = textAlign === 'left' ? 'text-left' : textAlign === 'right' ? 'text-right' : 'text-center'
    const marginClass = textAlign === 'left' ? 'mr-auto' : textAlign === 'right' ? 'ml-auto' : 'mx-auto'
    const justifyClass = textAlign === 'left' ? 'justify-start' : textAlign === 'right' ? 'justify-end' : 'justify-center'
    const dropdownPositionClass = textAlign === 'left' ? 'left-0' : textAlign === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'

    const isGlass = borderStyle === 'glass'
    const topBorder = isGlass ? null : renderDecorativeBorder(borderStyle, borderColor, borderWidth, decorativeSymbol)
    const bottomBorder = isGlass ? null : renderDecorativeBorder(borderStyle, borderColor, borderWidth, decorativeSymbol)

    // Glass is a material now, not a height. This used to carry a 120px white
    // bloom and a 60px drop shadow of its own, which is why a page set flat
    // still had this card floating above it.
    const wrapperStyle: React.CSSProperties = isGlass
      ? { ...surface(tileId), maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }
      : { borderRadius: 'var(--radius-surface)' }

    return (
      <div
        className={`w-full px-6 ${textAlignClass}`}
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
            const dateLayout = settings.dateLayout || 'single-line'

            if (dateLayout === 'day-prominent' && settings.date) {
              const parts = parseDateParts(settings.date)
              if (parts) {
                return (
                  <div className="space-y-8" style={recipe('body')}>
                    <div className="space-y-4">
                      <div
                        className="text-4xl md:text-5xl lg:text-6xl font-bold leading-none tracking-tight"
                        style={recipe('data')}
                      >
                        {parts.day}{ordinalSuffix(parts.day)}
                      </div>
                      <div
                        className="text-sm md:text-base uppercase tracking-widest"
                        style={recipe('data')}
                      >
                        {parts.month} {parts.year}
                      </div>
                      <div
                        className="text-sm md:text-base uppercase tracking-widest font-medium"
                        style={recipe('data')}
                      >
                        {parts.weekday}
                        {settings.time && ` · ${formatTime(settings.time)}`}
                      </div>
                    </div>
                    {settings.location && (() => {
                      return (
                        <div className="space-y-2">
                          <div
                            className={`text-xl md:text-2xl font-normal leading-relaxed flex items-center ${justifyClass} gap-2`}
                            style={recipe('data')}
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
              <div className="space-y-8" style={recipe('body')}>
                {settings.date && (
                  <div className="space-y-2">
                    <div
                      className="mb-3"
                      style={recipe('eyebrow')}
                    >
                      Date
                    </div>
                    <div
                      className="text-xl md:text-2xl font-normal leading-relaxed"
                      style={recipe('data')}
                    >
                      {formatDate(settings.date)}
                    </div>
                  </div>
                )}
                {settings.time && (
                  <div className="space-y-2">
                    <div
                      className="mb-3"
                      style={recipe('eyebrow')}
                    >
                      Time
                    </div>
                    <div
                      className="text-xl md:text-2xl font-normal leading-relaxed"
                      style={recipe('data')}
                    >
                      {formatTime(settings.time)}
                    </div>
                  </div>
                )}
                {settings.location && (() => {

                  return (
                    <div className="space-y-2">
                      <div
                        className="mb-3"
                        style={recipe('eyebrow')}
                      >
                        Location
                      </div>
                      <div
                        className={`text-xl md:text-2xl font-normal leading-relaxed flex items-center ${justifyClass} gap-2`}
                        style={recipe('data')}
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
                      className="mb-3"
                      style={recipe('eyebrow')}
                    >
                      Dress Code
                    </div>
                    <div
                      className="text-xl md:text-2xl font-normal leading-relaxed italic"
                      style={recipe('data')}
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


  // Non-preview mode - the stand-in shown in the editor's tile list.
  const borderStyle = settings.borderStyle || 'elegant'
  const borderColor = 'var(--theme-muted)'
  const borderWidth = 1

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
        borderRadius: 'var(--radius-surface)',
        borderWidth: borderStyle === 'none' ? '0' : borderStyle === 'classic' ? '2px' : `${borderWidth}px`,
        borderColor: borderStyle === 'none' ? 'transparent' : borderColor,
      }}
    >
      <div className="space-y-3 text-sm" style={recipe('body')}>
        {settings.date && (
          <p>
            <span
              className="text-xs uppercase tracking-widest font-light italic mr-2"
              style={recipe('eyebrow')}
            >
              Date:
            </span>
            <span
              className="font-normal"
              style={recipe('data')}
            >
              {formatDate(settings.date)}
            </span>
          </p>
        )}
        {settings.time && (
          <p>
            <span
              className="text-xs uppercase tracking-widest font-light italic mr-2"
              style={recipe('eyebrow')}
            >
              Time:
            </span>
            <span
              className="font-normal"
              style={recipe('data')}
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
                  style={recipe('eyebrow')}
                >
                  Location:
                </span>
                <span
                  className="font-normal"
                  style={recipe('data')}
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
              style={recipe('eyebrow')}
            >
              Dress Code:
            </span>
            <span
              className="font-normal italic"
              style={recipe('data')}
            >
              {settings.dressCode}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}

