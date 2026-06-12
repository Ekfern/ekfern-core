'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import api, { getEventAnalyticsSummary, enableEventAnalyticsInsights, type EventAnalyticsSummary } from '@/lib/api'
import { getSiteUrl } from '@/lib/site-url'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logError, logDebug } from '@/lib/error-handler'
import { getInvitePage } from '@/lib/invite/api'
import QRCode from 'react-qr-code'
import { ChevronDown } from 'lucide-react'
import { computeEventStats } from '@/lib/events/computeEventStats'
import EventOverviewStats from '@/components/events/stats/EventOverviewStats'
import EventStatusBadge from '@/components/events/EventStatusBadge'
import NextActionCard from '@/components/events/NextActionCard'
import { updateCatalog } from '@/lib/catalog/api'

interface Event {
  id: number
  slug: string
  title: string
  event_type: string
  date: string
  expiry_date?: string | null
  is_expired?: boolean
  city: string
  is_public: boolean
  page_config?: Record<string, any>
  has_rsvp: boolean
  has_registry: boolean
  whatsapp_message_template?: string
  event_structure?: 'SIMPLE' | 'ENVELOPE'
  rsvp_mode?: 'PER_SUBEVENT' | 'ONE_TAP_ALL'
  rsvp_experience_mode?: 'standard' | 'sub_event' | 'slot_based' | 'auto_confirm'
  rsvp_total_capacity?: number | null
  mode_switch_locked?: boolean
  host_name?: string
}


interface BookingSlot {
  id: number
  slot_date: string
  start_at: string
  end_at: string
  label: string
  capacity_total: number
  remaining_seats: number
  status: 'available' | 'unavailable' | 'sold_out' | 'hidden'
}

type InvitePublishStatus = 'Published' | 'Draft' | 'Not created' | 'Unknown'
type LinkKey = 'invite' | 'rsvp' | 'registry'

const qrDestinationLabel: Record<LinkKey, string> = {
  invite: 'Invite Page',
  rsvp: 'RSVP Page',
  registry: 'Catalog Page',
}

export default function EventDetailPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const { showToast } = useToast()
  const [event, setEvent] = useState<Event | null>(null)
  const [catalogResponseCount, setCatalogResponseCount] = useState<number>(0)
  const [guests, setGuests] = useState<any[]>([])
  const [rsvps, setRsvps] = useState<any[]>([])
  const [bookingSlots, setBookingSlots] = useState<BookingSlot[]>([])
  const [subEvents, setSubEvents] = useState<Array<{ id: number; title: string }>>([])
  const [loading, setLoading] = useState(true)
  const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [pendingPrivacyChange, setPendingPrivacyChange] = useState<boolean | null>(null)
  const [showExpiryEditor, setShowExpiryEditor] = useState(false)
  const [expiryDate, setExpiryDate] = useState('')
  const [savingExpiry, setSavingExpiry] = useState(false)
  const [showSlugEditor, setShowSlugEditor] = useState(false)
  const [slugDraft, setSlugDraft] = useState('')
  const [savingSlug, setSavingSlug] = useState(false)
  const [impact, setImpact] = useState<any>(null)
  const [invitePublishStatus, setInvitePublishStatus] = useState<InvitePublishStatus>('Unknown')
  const [openQrKey, setOpenQrKey] = useState<LinkKey | null>(null)
  const [openActionsKey, setOpenActionsKey] = useState<LinkKey | null>(null)
  const [downloadPickerKey, setDownloadPickerKey] = useState<LinkKey | null>(null)
  const [downloadFormat, setDownloadFormat] = useState<'professional' | 'raw'>('professional')
  const [analyticsSummary, setAnalyticsSummary] = useState<EventAnalyticsSummary | null>(null)
  const [enablingInsights, setEnablingInsights] = useState(false)

  const normalizeListResponse = (payload: any): any[] => {
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.results)) return payload.results
    if (Array.isArray(payload?.items)) return payload.items
    if (Array.isArray(payload?.orders)) return payload.orders
    if (Array.isArray(payload?.data)) return payload.data
    return []
  }

  useEffect(() => {
    if (!eventId || eventId === 'undefined') {
      logError('Invalid eventId:', eventId)
      showToast('Invalid event ID', 'error')
      router.push('/host/dashboard')
      return
    }
    fetchEvent()
    fetchCatalogResponseCount()
    fetchGuests()
    fetchRsvps()
  }, [eventId, router])

  useEffect(() => {
    if (!eventId || eventId === 'undefined') return
    let cancelled = false
    getEventAnalyticsSummary(parseInt(eventId))
      .then((data) => { if (!cancelled) setAnalyticsSummary(data) })
      .catch(() => { if (!cancelled) setAnalyticsSummary(null) })
    return () => { cancelled = true }
  }, [eventId])

  useEffect(() => {
    if (event && showExpiryEditor) {
      setExpiryDate(event.expiry_date || event.date || '')
    }
  }, [event, showExpiryEditor])

  useEffect(() => {
    // Fetch impact if event is expired
    if (event && event.is_expired) {
      fetchImpact()
    }
  }, [event])

  useEffect(() => {
    if (event?.rsvp_experience_mode === 'slot_based') {
      fetchBookingSlots()
    }
  }, [event?.rsvp_experience_mode])

  useEffect(() => {
    if (event?.rsvp_experience_mode === 'sub_event') {
      fetchSubEvents()
    } else {
      setSubEvents([])
    }
  }, [event?.rsvp_experience_mode, eventId])

  useEffect(() => {
    let cancelled = false

    const loadInvitePublishStatus = async () => {
      if (!event || !eventId || eventId === 'undefined') return

      const hasConfig = !!(event.page_config && Object.keys(event.page_config).length > 0)
      if (!hasConfig) {
        if (!cancelled) setInvitePublishStatus('Not created')
        return
      }

      try {
        const invite = await getInvitePage(parseInt(eventId))
        if (cancelled) return
        if (!invite) {
          setInvitePublishStatus('Not created')
          return
        }
        setInvitePublishStatus(invite.is_published ? 'Published' : 'Draft')
      } catch {
        if (!cancelled) setInvitePublishStatus('Unknown')
      }
    }

    loadInvitePublishStatus()
    return () => {
      cancelled = true
    }
  }, [event, eventId])

  const fetchEvent = async () => {
    if (!eventId || eventId === 'undefined') {
      return
    }
    try {
      const response = await api.get(`/api/events/${eventId}/`)
      setEvent(response.data)
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push('/host/login')
      } else if (error.response?.status === 403 || error.response?.status === 404) {
        // 403: Permission denied (not owner) or 404: Event not found
        showToast('You do not have access to this event', 'error')
        router.push('/host/dashboard')
      } else {
        logError('Failed to fetch event:', error)
        showToast(getErrorMessage(error), 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchCatalogResponseCount = async () => {
    if (!eventId || eventId === 'undefined') return
    try {
      const response = await api.get(`/api/events/${eventId}/catalog/responses/`)
      const data = normalizeListResponse(response.data)
      setCatalogResponseCount(Array.isArray(data) ? data.length : 0)
    } catch {
      setCatalogResponseCount(0)
    }
  }

  const fetchGuests = async () => {
    if (!eventId || eventId === 'undefined') {
      return
    }
    try {
      const response = await api.get(`/api/events/${eventId}/guests/`)
      // Handle both old format (array) and new format (object with guests and other_guests)
      if (Array.isArray(response.data)) {
        setGuests(response.data)
      } else {
        setGuests(normalizeListResponse(response.data?.guests))
      }
    } catch (error) {
      // Guest list might not exist yet, that's okay
      logDebug('No guest list found')
      setGuests([])
    }
  }

  const fetchRsvps = async () => {
    if (!eventId || eventId === 'undefined') {
      return
    }
    try {
      const response = await api.get(`/api/events/${eventId}/rsvps/`)
      setRsvps(normalizeListResponse(response.data))
    } catch (error) {
      // RSVPs might not exist yet, that's okay
      logDebug('No RSVPs found')
      setRsvps([])
    }
  }

  const fetchBookingSlots = async () => {
    if (!eventId || eventId === 'undefined') return
    try {
      const response = await api.get(`/api/events/${eventId}/booking-slots/`)
      const data = response.data
      setBookingSlots(Array.isArray(data) ? data : normalizeListResponse(data))
    } catch {
      setBookingSlots([])
    }
  }

  const fetchSubEvents = async () => {
    if (!eventId || eventId === 'undefined') return
    try {
      const response = await api.get(`/api/events/envelopes/${eventId}/sub-events/`)
      const rows = normalizeListResponse(response.data)
      setSubEvents(rows.map((s: any) => ({ id: s.id, title: s.title })))
    } catch {
      setSubEvents([])
    }
  }

  const fetchImpact = async () => {
    if (!eventId || eventId === 'undefined') {
      return
    }
    try {
      const response = await api.get(`/api/events/${eventId}/impact/`)
      setImpact(response.data)
    } catch (error: any) {
      // Silently fail - impact is optional
      logError('Failed to fetch impact:', error)
    }
  }

  const handleSaveExpiry = async () => {
    if (!eventId || eventId === 'undefined' || !event) {
      return
    }
    setSavingExpiry(true)
    try {
      await api.patch(`/api/events/${eventId}/`, {
        expiry_date: expiryDate || null,
      })
      showToast('Expiry date updated successfully', 'success')
      setShowExpiryEditor(false)
      fetchEvent()
    } catch (error: any) {
      showToast('Failed to update expiry date', 'error')
    } finally {
      setSavingExpiry(false)
    }
  }

  const handlePrivacyToggle = (newValue: boolean) => {
    setPendingPrivacyChange(newValue)
    setShowPrivacyModal(true)
  }

  const confirmPrivacyChange = async () => {
    if (pendingPrivacyChange === null || !event) return
    
    try {
      await api.patch(`/api/events/${eventId}/`, {
        is_public: pendingPrivacyChange,
      })
      showToast(
        pendingPrivacyChange
          ? 'Event is now public. Anyone with the link can RSVP and use the host catalog.'
          : 'Event is now private. Only invited guests can RSVP and use the host catalog.',
        'success'
      )
      fetchEvent()
      setShowPrivacyModal(false)
      setPendingPrivacyChange(null)
    } catch (error: any) {
      showToast('Failed to update event privacy setting', 'error')
      setShowPrivacyModal(false)
      setPendingPrivacyChange(null)
    }
  }

  const buildUrl = (key: LinkKey, source: 'link' | 'qr') => {
    const base = getSiteUrl()
    if (!event) return ''
    const path = key === 'invite' ? `/invite/${event.slug}`
      : key === 'rsvp' ? `/event/${event.slug}/rsvp`
      : `/catalog/${event.slug}`
    return `${base}${path}?source=${source}`
  }

  const escapeSvgText = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')

  const truncateText = (value: string, maxLength: number) =>
    value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value

  const buildProfessionalQrSvg = (key: LinkKey, qrSvgElement: SVGSVGElement) => {
    const viewBox = qrSvgElement.getAttribute('viewBox') || ''
    const viewBoxParts = viewBox.split(/\s+/).map(Number)
    const qrViewBoxSize =
      viewBoxParts.length === 4 && Number.isFinite(viewBoxParts[2]) && viewBoxParts[2] > 0
        ? viewBoxParts[2]
        : 29
    const qrPathMarkup = qrSvgElement.innerHTML

    // A5 portrait print-friendly canvas (148mm x 210mm), 10 units per mm
    const canvasWidth = 1480
    const canvasHeight = 2100
    const cardX = 70
    const cardY = 70
    const cardWidth = canvasWidth - cardX * 2
    const cardHeight = canvasHeight - cardY * 2
    const qrFrameSize = 820
    const qrScale = qrFrameSize / qrViewBoxSize
    const qrTranslateX = (canvasWidth - qrFrameSize) / 2
    const qrTranslateY = 690

    const safeEventTitle = escapeSvgText(truncateText(event?.title?.trim() || 'Event Invitation', 58))
    const safeDestinationLabel = escapeSvgText(qrDestinationLabel[key])

    const badgeWidth = qrViewBoxSize * 0.42
    const badgeHeight = qrViewBoxSize * 0.11
    const badgeX = (qrViewBoxSize - badgeWidth) / 2
    const badgeY = (qrViewBoxSize - badgeHeight) / 2
    const badgeRadius = badgeHeight * 0.5
    const badgeInset = badgeHeight * 0.14
    const badgeInnerWidth = badgeWidth - badgeInset * 2
    const badgeInnerHeight = badgeHeight - badgeInset * 2
    const badgeInnerRadius = badgeRadius * 0.9
    const badgeFontSize = badgeInnerHeight * 0.55
    const brandBadgeMarkup = `
      <rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}" rx="${badgeRadius}" fill="#FFFFFF" stroke="#D7E6D2" stroke-width="${badgeHeight * 0.03}" />
      <text x="${qrViewBoxSize / 2}" y="${qrViewBoxSize / 2}" text-anchor="middle" dominant-baseline="central" font-size="${badgeFontSize}" font-family="Inter, Arial, sans-serif" font-weight="700" fill="#2C6B3F">Ekfern</text>
    `

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="148mm" height="210mm" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="qrCardGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#F5F8F1" />
    </linearGradient>
  </defs>
  <rect width="${canvasWidth}" height="${canvasHeight}" fill="#FFFFFF" />
  <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="36" fill="url(#qrCardGradient)" stroke="#CDE2C8" stroke-width="3" />
  <text x="${canvasWidth / 2}" y="260" text-anchor="middle" font-size="64" font-family="Inter, Arial, sans-serif" font-weight="700" fill="#2C6B3F">${safeEventTitle}</text>
  <text x="${canvasWidth / 2}" y="340" text-anchor="middle" font-size="40" font-family="Inter, Arial, sans-serif" font-weight="600" fill="#3A8A4D">${safeDestinationLabel}</text>
  <text x="${canvasWidth / 2}" y="410" text-anchor="middle" font-size="28" font-family="Inter, Arial, sans-serif" fill="#5E6E63">Scan this QR code to open instantly</text>
  <rect x="${(canvasWidth - (qrFrameSize + 72)) / 2}" y="${qrTranslateY - 36}" width="${qrFrameSize + 72}" height="${qrFrameSize + 72}" rx="30" fill="#FFFFFF" stroke="#D7E6D2" stroke-width="2" />
  <g transform="translate(${qrTranslateX}, ${qrTranslateY}) scale(${qrScale})">
    ${qrPathMarkup}
    ${brandBadgeMarkup}
  </g>
  <text x="${canvasWidth / 2}" y="${qrTranslateY + qrFrameSize + 130}" text-anchor="middle" font-size="26" font-family="Inter, Arial, sans-serif" fill="#5E6E63">Built with Ekfern</text>
</svg>`
  }

  const buildRawBrandedQrSvg = (qrSvgElement: SVGSVGElement) => {
    const width = qrSvgElement.getAttribute('width') || '148'
    const height = qrSvgElement.getAttribute('height') || '148'
    const viewBox = qrSvgElement.getAttribute('viewBox') || '0 0 29 29'
    const viewBoxParts = viewBox.split(/\s+/).map(Number)
    const qrViewBoxSize =
      viewBoxParts.length === 4 && Number.isFinite(viewBoxParts[2]) && viewBoxParts[2] > 0
        ? viewBoxParts[2]
        : 29
    const qrPathMarkup = qrSvgElement.innerHTML

    const badgeWidth = qrViewBoxSize * 0.42
    const badgeHeight = qrViewBoxSize * 0.11
    const badgeX = (qrViewBoxSize - badgeWidth) / 2
    const badgeY = (qrViewBoxSize - badgeHeight) / 2
    const badgeRadius = badgeHeight * 0.5
    const badgeInset = badgeHeight * 0.14
    const badgeInnerWidth = badgeWidth - badgeInset * 2
    const badgeInnerHeight = badgeHeight - badgeInset * 2
    const badgeInnerRadius = badgeRadius * 0.9
    const badgeFontSize = badgeInnerHeight * 0.55

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
  ${qrPathMarkup}
  <rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}" rx="${badgeRadius}" fill="#FFFFFF" stroke="#D7E6D2" stroke-width="${badgeHeight * 0.03}" />
  <text x="${qrViewBoxSize / 2}" y="${qrViewBoxSize / 2}" text-anchor="middle" dominant-baseline="central" font-size="${badgeFontSize}" font-family="Inter, Arial, sans-serif" font-weight="700" fill="#2C6B3F">Ekfern</text>
</svg>`
  }

  const downloadSvgBlob = (svgString: string, filename: string) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    link.click()
    URL.revokeObjectURL(blobUrl)
  }

  const handleDownloadProfessionalQr = (key: LinkKey) => {
    const wrapper = document.getElementById(`tracked-qr-${key}`)
    const svg = wrapper?.querySelector('svg')
    if (!svg) {
      showToast('QR preview not available yet', 'error')
      return
    }

    const svgString = buildProfessionalQrSvg(key, svg)
    if (!svgString) {
      showToast('Unable to generate QR download', 'error')
      return
    }
    downloadSvgBlob(svgString, `${event?.slug || 'event'}-${key}-qr-professional.svg`)
    showToast('Professional QR downloaded', 'success')
  }

  const handleDownloadRawQr = (key: LinkKey) => {
    const wrapper = document.getElementById(`tracked-qr-${key}`)
    const svg = wrapper?.querySelector('svg')
    if (!svg) {
      showToast('QR preview not available yet', 'error')
      return
    }
    const rawSvgString = buildRawBrandedQrSvg(svg)
    downloadSvgBlob(rawSvgString, `${event?.slug || 'event'}-${key}-qr-raw.svg`)
    showToast('Raw QR downloaded', 'success')
  }

  const handleDownloadWithFormat = (key: LinkKey) => {
    if (downloadFormat === 'professional') {
      handleDownloadProfessionalQr(key)
    } else {
      handleDownloadRawQr(key)
    }
    setDownloadPickerKey(null)
  }

  const handleCopyLink = async (key: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedLinkKey(key)
      showToast('Link copied!', 'success')
      setTimeout(() => setCopiedLinkKey(null), 2000)
    } catch {
      showToast('Failed to copy link', 'error')
    }
  }

  const handleShareLink = async (label: string, url: string) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${event?.title || 'Event'} - ${label}`,
          text: `Sharing ${label} for ${event?.title || 'event'}`,
          url,
        })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopiedLinkKey(label)
      showToast('Share not supported on this browser. Link copied instead.', 'info')
      setTimeout(() => setCopiedLinkKey(null), 2000)
    } catch (error) {
      showToast('Unable to share link', 'error')
    }
  }

  const handleEnableInsights = async () => {
    if (!eventId || eventId === 'undefined') return
    try {
      setEnablingInsights(true)
      await enableEventAnalyticsInsights(parseInt(eventId))
      const data = await getEventAnalyticsSummary(parseInt(eventId))
      setAnalyticsSummary(data)
      showToast('Tracking insights enabled. Click details are now visible.', 'success')
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Failed to enable tracking insights', 'error')
    } finally {
      setEnablingInsights(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <div className="text-eco-green text-xl">Loading...</div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <div className="text-eco-green text-xl">Event not found</div>
      </div>
    )
  }

  const activeGuests = guests.filter((g) => !g.is_removed)
  const totalGuests = activeGuests.length

  const eventStats = computeEventStats({
    eventId,
    rsvpExperienceMode: event.rsvp_experience_mode,
    rsvpMode: event.rsvp_mode,
    rsvpTotalCapacity: event.rsvp_total_capacity,
    guests,
    rsvps,
    bookingSlots,
    subEvents,
  })
  const responseRate = eventStats.invited.rsvpPercent

  const inviteStatusLabel =
    invitePublishStatus === 'Published'
      ? 'Live'
      : invitePublishStatus === 'Draft'
        ? 'Configured - Waiting to Publish'
        : 'Not Configured'
  const inviteVisibilityLabel = event.is_public ? 'Public' : 'Private'

  const eventDateObj = event.date ? new Date(event.date) : null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let countdownLabel: string | null = null
  if (eventDateObj) {
    const eventDay = new Date(eventDateObj)
    eventDay.setHours(0, 0, 0, 0)
    const diffDays = Math.round((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) countdownLabel = 'Today'
    else if (diffDays === 1) countdownLabel = 'Tomorrow'
    else if (diffDays > 1) countdownLabel = `In ${diffDays} days`
    else countdownLabel = `${Math.abs(diffDays)} days ago`
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      <div className="container mx-auto px-4 py-6 md:py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-eco-green mb-1">{event.title}</h1>
          <p className="text-sm text-gray-600 mb-3">
            <span className="capitalize">{event.event_type}</span>
            {event.city ? ` · ${event.city}` : ''}
            {eventDateObj ? ` · ${eventDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <EventStatusBadge
              status={invitePublishStatus}
              isPublic={event.is_public}
              isExpired={event.is_expired}
            />
            {countdownLabel && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                event.is_expired
                  ? 'bg-gray-100 border-gray-200 text-gray-500'
                  : countdownLabel === 'Today' || countdownLabel === 'Tomorrow'
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-eco-green/5 border-eco-green-light text-eco-green'
              }`}>
                {countdownLabel}
              </span>
            )}
          </div>
        </div>

        {event.has_rsvp && <EventOverviewStats stats={eventStats} />}

        {/* Contextual next action */}
        <NextActionCard
          eventId={eventId}
          invitePublishStatus={invitePublishStatus}
          totalGuests={totalGuests}
          responseRate={responseRate}
          isExpired={event.is_expired}
        />

        <Card className="bg-white border-2 border-eco-green-light mb-8">
          <CardHeader>
            <CardTitle className="text-eco-green">Share your event</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'invite' as LinkKey, label: 'Invite Page', show: true },
              { key: 'rsvp' as LinkKey, label: 'RSVP Page', show: event.has_rsvp },
              { key: 'registry' as LinkKey, label: 'Catalog Page', show: event.has_registry },
            ]
              .filter((item) => item.show)
              .map((item) => {
                return (
                <div key={item.key} className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">{item.label}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={buildUrl(item.key, 'link')}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
                    />
                    <div className="relative">
                      <Button
                        onClick={() => setOpenActionsKey((prev) => (prev === item.key ? null : item.key))}
                        variant="outline"
                        aria-haspopup="menu"
                        aria-expanded={openActionsKey === item.key}
                        className="border-eco-green text-eco-green hover:bg-eco-green-light inline-flex items-center gap-2"
                      >
                        Actions
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${openActionsKey === item.key ? 'rotate-180' : ''}`}
                        />
                      </Button>
                      {openActionsKey === item.key && (
                        <div className="absolute right-0 mt-2 w-44 rounded-md border border-gray-200 bg-white shadow-lg z-20">
                          <button
                            type="button"
                            onClick={() => {
                              handleCopyLink(item.key, buildUrl(item.key, 'link'))
                              setOpenActionsKey(null)
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            {copiedLinkKey === item.key ? 'Copied' : 'Copy'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleShareLink(item.label, buildUrl(item.key, 'link'))
                              setOpenActionsKey(null)
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Share
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenQrKey((prev) => (prev === item.key ? null : item.key))
                              setOpenActionsKey(null)
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            {openQrKey === item.key ? 'Hide QR' : 'Show QR'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDownloadPickerKey(item.key)
                              setDownloadFormat('professional')
                              setOpenActionsKey(null)
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Download QR
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {downloadPickerKey === item.key && (
                    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                      <p className="text-sm font-semibold text-eco-green">Download QR</p>
                      <p className="mt-1 text-xs text-gray-600">
                        Choose the export format before downloading.
                      </p>

                      <div className="mt-3 space-y-2">
                        <label className="flex items-start gap-2 rounded-md border border-gray-200 p-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`download-format-${item.key}`}
                            checked={downloadFormat === 'professional'}
                            onChange={() => setDownloadFormat('professional')}
                            className="mt-1"
                          />
                          <span className="text-sm text-gray-700">
                            Professional SVG (styled card, centered layout)
                          </span>
                        </label>
                        <label className="flex items-start gap-2 rounded-md border border-gray-200 p-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`download-format-${item.key}`}
                            checked={downloadFormat === 'raw'}
                            onChange={() => setDownloadFormat('raw')}
                            className="mt-1"
                          />
                          <span className="text-sm text-gray-700">Raw SVG (QR only)</span>
                        </label>
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setDownloadPickerKey(null)}
                          className="h-8 px-3 text-xs border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleDownloadWithFormat(item.key)}
                          className="h-8 px-3 text-xs bg-eco-green hover:bg-eco-green-dark text-white"
                        >
                          Download
                        </Button>
                      </div>
                    </div>
                  )}

                  <div
                    id={`tracked-qr-${item.key}`}
                    className={
                      openQrKey === item.key
                        ? 'mt-1 w-full rounded-xl border border-eco-green-light bg-gradient-to-b from-white to-eco-green-light/20 p-4 shadow-sm flex flex-col items-center'
                        : 'hidden'
                    }
                  >
                    <div className="text-center mb-3">
                      <p className="text-sm font-semibold text-eco-green">{item.label} QR</p>
                      <p className="text-xs text-gray-600">Guests can scan this to open the page instantly.</p>
                    </div>

                    <div className="mx-auto inline-block rounded-lg bg-white p-3 border border-gray-200 shadow-sm">
                      <div className="relative inline-block">
                        <QRCode value={buildUrl(item.key, 'qr')} size={148} level="H" />
                        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#D7E6D2] bg-white px-2 py-0.5">
                          <span className="text-[9px] leading-none font-semibold text-eco-green">Ekfern</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-center">
                      <Button
                        type="button"
                        onClick={() => setOpenQrKey(null)}
                        variant="outline"
                        className="h-8 px-3 text-xs border-eco-green text-eco-green hover:bg-eco-green-light"
                      >
                        Hide QR
                      </Button>
                    </div>
                  </div>
                </div>
              )})}
            {!event.has_rsvp && !event.has_registry && (
              <div className="text-sm text-gray-600">
                RSVP and Host Catalog links will appear here when those features are enabled.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Click details (attribution & funnel) – only show destinations enabled for this event */}
        {analyticsSummary && (
          <Card className="bg-white border-2 border-eco-green-light mb-8">
            <CardHeader>
              <CardTitle className="text-eco-green">Click details</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                QR and link traffic by destination and channel. In the future this will move to a dedicated analytics or reports page.
              </p>
            </CardHeader>
            <CardContent>
              {analyticsSummary.insights_locked ? (
                <div className="rounded-lg border border-dashed border-eco-green-light p-4 bg-gray-50">
                  <p className="text-sm font-semibold text-eco-green">Attribution insights locked</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Link and QR traffic is being collected. Enable insights to view click and funnel stats here.
                  </p>
                  <Button
                    type="button"
                    onClick={handleEnableInsights}
                    disabled={enablingInsights}
                    className="mt-3 bg-eco-green hover:bg-eco-green-dark text-white h-8 px-3 text-xs"
                  >
                    {enablingInsights ? 'Enabling...' : (analyticsSummary.insights_cta_label || 'Enable tracking insights')}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-eco-green-light p-3 bg-white">
                      <p className="text-xs font-semibold text-eco-green">Attribution clicks</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{analyticsSummary.attribution_clicks_total ?? 0}</p>
                      <p className="text-xs text-gray-500 mt-1">Tracked QR/link redirects</p>
                    </div>
                    <div className="rounded-lg border border-eco-green-light p-3 bg-white">
                      <p className="text-xs font-semibold text-eco-green">Clicks by destination</p>
                      <p className="text-sm text-gray-700 mt-2">
                        {[
                          `Invite: ${analyticsSummary.target_type_clicks?.invite ?? 0}`,
                          event.has_rsvp && `RSVP: ${analyticsSummary.target_type_clicks?.rsvp ?? 0}`,
                          event.has_registry && `Catalog: ${analyticsSummary.target_type_clicks?.registry ?? 0}`,
                        ].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                    <div className="rounded-lg border border-eco-green-light p-3 bg-white">
                      <p className="text-xs font-semibold text-eco-green">Clicks by channel</p>
                      <p className="text-sm text-gray-700 mt-2">
                        QR: {analyticsSummary.source_channel_breakdown?.qr ?? 0} • Link: {analyticsSummary.source_channel_breakdown?.link ?? 0}
                      </p>
                    </div>
                  </div>
                  {analyticsSummary.funnel && (
                    <div className="mt-3 rounded-lg border border-eco-green-light p-3 bg-white">
                      <p className="text-xs font-semibold text-eco-green">Destination funnels</p>
                      <div className="text-sm text-gray-700 mt-2 space-y-1">
                        <p>
                          Invite: {analyticsSummary.funnel.invite?.clicks ?? 0} clicks → {analyticsSummary.funnel.invite?.views ?? 0} views → {analyticsSummary.funnel.invite?.rsvp_submissions ?? 0} RSVPs
                        </p>
                        {event.has_rsvp && (
                          <p>
                            RSVP: {analyticsSummary.funnel.rsvp?.clicks ?? 0} clicks → {analyticsSummary.funnel.rsvp?.views ?? 0} views → {analyticsSummary.funnel.rsvp?.rsvp_submissions ?? 0} RSVPs
                          </p>
                        )}
                        {event.has_registry && (
                          <p>
                            Catalog: {(analyticsSummary.funnel as any).catalog?.clicks ?? analyticsSummary.funnel.registry?.clicks ?? 0} clicks → {(analyticsSummary.funnel as any).catalog?.total_responses ?? 0} responses
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sustainability impact (expired events) or live catalog responses */}
        {event.is_expired && impact ? (
          <Card className="bg-white border-2 border-eco-green-light mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-eco-green text-base">Sustainability Impact</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-eco-green">{impact.food_saved?.plates_saved || 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Plates saved</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-eco-green">{impact.paper_saved?.web_rsvps || 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Paper RSVPs saved</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-eco-green">{impact.gifts_received?.total_gifts || 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Catalog pledges</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-eco-green">
                    ₹{(impact.gifts_received?.total_value_rupees || 0).toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Pledge value</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : event?.has_registry ? (
          <Card className="bg-white border-2 border-eco-green-light mb-6">
            <CardContent className="pt-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-2xl font-bold text-eco-green leading-none">{catalogResponseCount}</p>
                <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide font-medium">Catalog responses</p>
              </div>
              <a
                href={`/host/events/${eventId}/catalog/responses`}
                className="text-sm text-eco-green underline hover:no-underline"
              >
                View responses →
              </a>
            </CardContent>
          </Card>
        ) : null}

        {/* Settings & Configuration Section */}
        <div className="mb-8">
          <Card className="bg-white border-2 border-eco-green-light">
            <CardContent className="pt-6">
              <details>
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold text-eco-green">Settings & Configuration</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {event.is_public ? 'Public' : 'Private'}
                        {' · '}
                        {event.has_rsvp ? 'RSVP on' : 'RSVP off'}
                        {' · '}
                        {event.has_registry ? 'Host catalog on' : 'Host catalog off'}
                        {' · '}
                        {event.rsvp_experience_mode === 'sub_event'
                          ? 'Sub-event RSVP'
                          : event.rsvp_experience_mode === 'slot_based'
                            ? 'Slot-based RSVP'
                            : 'Standard RSVP'}
                      </p>
                    </div>
                    <span className="text-xs rounded-full bg-eco-green-light px-3 py-1 font-medium text-eco-green whitespace-nowrap">
                      Expand
                    </span>
                  </div>
                </summary>
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Event Features */}
                  <Card className="bg-white border-2 border-eco-green-light">
                    <CardHeader>
                      <CardTitle className="text-eco-green">Event Features</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">RSVP</span>
                            <p className="text-xs text-gray-500">Allow guests to confirm attendance</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={event.has_rsvp}
                            onChange={async (e) => {
                              try {
                                await api.patch(`/api/events/${eventId}/`, {
                                  has_rsvp: e.target.checked,
                                })
                                showToast('RSVP setting updated', 'success')
                                fetchEvent()
                              } catch (error: any) {
                                showToast('Failed to update RSVP setting', 'error')
                              }
                            }}
                            className="form-checkbox text-eco-green"
                          />
                        </label>
                      </div>

                      <div>
                        <label className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">Host Catalog</span>
                            <p className="text-xs text-gray-500">
                              Let guests browse catalog items and send pledges or interest
                            </p>
                            {event.has_registry && (
                              <a
                                href={`/host/events/${eventId}/catalog`}
                                className="text-sm text-eco-green underline hover:no-underline mt-1 inline-block"
                              >
                                Manage catalog →
                              </a>
                            )}
                          </div>
                          <input
                            type="checkbox"
                            checked={event.has_registry}
                            onChange={async (e) => {
                              try {
                                await updateCatalog(parseInt(eventId, 10), { is_enabled: e.target.checked })
                                showToast('Host Catalog setting updated', 'success')
                                fetchEvent()
                              } catch (error: any) {
                                showToast('Failed to update Host Catalog setting', 'error')
                              }
                            }}
                            className="form-checkbox text-eco-green flex-shrink-0"
                          />
                        </label>
                      </div>

                      {/* Privacy Toggle */}
                      <div className="pt-3 border-t">
                        <label className="flex items-center justify-between cursor-pointer">
                          <div className="flex-1">
                            <span className="font-medium text-sm text-gray-700 block mb-1">
                              {event.is_public ? 'Public Event' : 'Private Event'}
                            </span>
                            <p className="text-xs text-gray-500">
                              {event.is_public
                                ? 'Anyone with the link can RSVP and respond on the host catalog'
                                : 'Only invited guests can RSVP and use the host catalog'}
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={event.is_public}
                            onClick={() => handlePrivacyToggle(!event.is_public)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-eco-green focus:ring-offset-2 ${
                              event.is_public ? 'bg-eco-green' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                event.is_public ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </label>
                      </div>

                      <div className="pt-3 border-t space-y-2">
                        <p className="text-sm font-medium text-gray-700">RSVP experience</p>
                        <p className="text-sm text-gray-800">
                          {event.rsvp_experience_mode === 'sub_event'
                            ? 'Sub-event RSVP'
                            : event.rsvp_experience_mode === 'slot_based'
                              ? 'Slot-based RSVP'
                              : 'Standard RSVP'}
                        </p>
                        {event.rsvp_experience_mode === 'sub_event' && (
                          <p className="text-xs text-gray-600">
                            Sub-event style:{' '}
                            {event.rsvp_mode === 'ONE_TAP_ALL' ? 'One tap all' : 'Per sub-event'}
                          </p>
                        )}
                        {event.mode_switch_locked && (
                          <p className="text-xs text-amber-800">
                            Mode switching is locked while you have RSVP responses or confirmed slot bookings.
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          To change RSVP mode or sub-event style, use RSVP Settings.
                        </p>
                        <Link href={`/host/events/${eventId}/rsvp`}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-eco-green text-eco-green hover:bg-eco-green-light"
                          >
                            Open RSVP Settings
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Right Column: Wrapper for conditional cards */}
                  <div className="space-y-6">
                  {/* Event Expiry Management */}
                  {event.is_expired && (
                    <Card className="bg-white border-2 border-gray-300">
                      <CardHeader>
                        <CardTitle className="text-gray-600">Event Expired</CardTitle>
                        <p className="text-sm text-gray-500 mt-1">
                          This event has passed its expiry date. You can extend it to reactivate.
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {!showExpiryEditor ? (
                          <>
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                              <p className="text-sm text-gray-700">
                                <strong>Event Date:</strong> {event.date ? new Date(event.date).toLocaleDateString('en-IN', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                }) : 'Not set'}
                              </p>
                              <p className="text-sm text-gray-700 mt-2">
                                <strong>Expiry Date:</strong> {event.expiry_date ? new Date(event.expiry_date).toLocaleDateString('en-IN', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                }) : (event.date ? new Date(event.date).toLocaleDateString('en-IN', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                }) : 'Not set')}
                              </p>
                            </div>
                            <Button
                              onClick={() => setShowExpiryEditor(true)}
                              className="bg-eco-green hover:bg-eco-green-dark text-white"
                            >
                              Extend Expiry Date
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">New Expiry Date</label>
                              <input
                                type="date"
                                value={expiryDate}
                                onChange={(e) => setExpiryDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              />
                              <p className="text-xs text-gray-500">
                                Set a future date to reactivate this event. Leave empty to use event date.
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={handleSaveExpiry}
                                disabled={savingExpiry}
                                className="bg-eco-green hover:bg-eco-green-dark text-white"
                              >
                                {savingExpiry ? 'Saving...' : 'Save Expiry Date'}
                              </Button>
                              <Button
                                onClick={() => {
                                  setExpiryDate(event.expiry_date || event.date || '')
                                  setShowExpiryEditor(false)
                                }}
                                variant="outline"
                                className="border-gray-300 text-gray-700 hover:bg-gray-50"
                              >
                                Cancel
                              </Button>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Invite URL (slug) */}
                  <Card className="bg-white border-2 border-eco-green-light">
                    <CardHeader>
                      <CardTitle className="text-eco-green">Invite URL</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {!showSlugEditor ? (
                        <>
                          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm font-mono text-gray-700 break-all">
                            /invite/<strong>{event?.slug}</strong>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSlugDraft(event?.slug ?? '')
                              setShowSlugEditor(true)
                            }}
                          >
                            Change URL
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                            ⚠️ Changing your invite URL will break any links you've already shared. Update all shared links after saving.
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 shrink-0">/invite/</span>
                            <input
                              type="text"
                              value={slugDraft}
                              onChange={(e) => setSlugDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                              className="flex-1 h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
                              placeholder="your-event-slug"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={savingSlug || !slugDraft.trim() || slugDraft === event?.slug}
                              onClick={async () => {
                                setSavingSlug(true)
                                try {
                                  await api.patch(`/api/events/${eventId}/`, { slug: slugDraft.trim() })
                                  showToast('Invite URL updated', 'success')
                                  setShowSlugEditor(false)
                                  fetchEvent()
                                } catch (error: any) {
                                  const msg = error?.response?.data?.slug?.[0] ?? error?.response?.data?.detail ?? 'Failed to update URL'
                                  showToast(msg, 'error')
                                } finally {
                                  setSavingSlug(false)
                                }
                              }}
                              className="bg-eco-green hover:bg-eco-green-dark text-white"
                            >
                              {savingSlug ? 'Saving…' : 'Save'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowSlugEditor(false)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  </div>
                </div>
              </details>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Privacy Confirmation Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-eco-green">
                {pendingPrivacyChange ? 'Make Event Public?' : 'Make Event Private?'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingPrivacyChange ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">
                    <strong className="text-green-600">Public Event:</strong> Anyone with the event URL or QR code can RSVP and respond on the host catalog, even if they are not on your guest list.
                  </p>
                  <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                    ⚠️ This means people you haven't invited can still participate in your event.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">
                    <strong className="text-blue-600">Private Event:</strong> Only people on your guest list can RSVP and use the host catalog.
                  </p>
                  <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                    ℹ️ People not on your guest list will be unable to RSVP or use the host catalog, even if they have the event link.
                  </p>
                </div>
              )}
              
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPrivacyModal(false)
                    setPendingPrivacyChange(null)
                  }}
                  className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmPrivacyChange}
                  className="flex-1 bg-eco-green hover:bg-eco-green-dark text-white"
                >
                  Confirm
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  )
}

