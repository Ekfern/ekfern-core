'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logError } from '@/lib/error-handler'
import type { InviteConfig, RsvpFormConfig } from '@/lib/invite/schema'
import RsvpFormEditor from '@/components/rsvp/RsvpFormEditor'

interface Event {
  id: number
  slug: string
  title: string
  has_rsvp: boolean
  is_public?: boolean
  event_structure?: 'SIMPLE' | 'ENVELOPE'
  rsvp_mode?: 'PER_SUBEVENT' | 'ONE_TAP_ALL'
  rsvp_experience_mode?: 'standard' | 'sub_event' | 'slot_based' | 'auto_confirm'
  rsvp_total_capacity?: number | null
  rsvp_block_on_full_capacity?: boolean
  rsvp_require_sub_event_selection?: boolean
  rsvp_mode_readiness?: {
    mode: 'standard' | 'sub_event' | 'slot_based' | 'auto_confirm'
    ready: boolean
    reasons: string[]
  }
  mode_switch_locked?: boolean
  mode_switch_lock_reasons?: string[]
  custom_fields_metadata?: Record<string, any>
  page_config?: InviteConfig
}

export default function HostRsvpSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()

  const eventId = params.eventId ? parseInt(params.eventId as string) : 0
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [event, setEvent] = useState<Event | null>(null)
  const [pageConfig, setPageConfig] = useState<InviteConfig | null>(null)
  const [rsvpForm, setRsvpForm] = useState<RsvpFormConfig | undefined>(undefined)
  const [activeMode, setActiveMode] = useState<'standard' | 'sub_event' | 'slot_based' | 'auto_confirm'>('standard')
  const [subEventMode, setSubEventMode] = useState<'PER_SUBEVENT' | 'ONE_TAP_ALL'>('PER_SUBEVENT')
  const [isPublic, setIsPublic] = useState<boolean>(true)
  const [rsvpTotalCapacity, setRsvpTotalCapacity] = useState<string>('')
  const [blockOnFullCapacity, setBlockOnFullCapacity] = useState(false)
  const [requireSubEventSelection, setRequireSubEventSelection] = useState(false)
  const [capacitySectionOpen, setCapacitySectionOpen] = useState(false)
  const [saveError, setSaveError] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      if (!eventId || isNaN(eventId)) return
      try {
        const resp = await api.get(`/api/events/${eventId}/`)
        const e = resp.data as Event
        setEvent(e)
        setActiveMode((e.rsvp_experience_mode as any) || 'standard')
        setSubEventMode(
          e.is_public ? 'PER_SUBEVENT' : ((e.rsvp_mode as any) || 'PER_SUBEVENT'),
        )
        setIsPublic(e.is_public ?? true)
        setRsvpTotalCapacity(
          e.rsvp_total_capacity != null && e.rsvp_total_capacity > 0
            ? String(e.rsvp_total_capacity)
            : '',
        )
        setBlockOnFullCapacity(Boolean(e.rsvp_block_on_full_capacity))
        setRequireSubEventSelection(Boolean(e.rsvp_require_sub_event_selection))
        setCapacitySectionOpen(
          (e.rsvp_total_capacity != null && e.rsvp_total_capacity > 0) ||
            Boolean(e.rsvp_block_on_full_capacity),
        )

        const pc: InviteConfig | null = (e.page_config as any) || null
        setPageConfig(pc)
        setRsvpForm((pc as any)?.rsvpForm as RsvpFormConfig | undefined)
      } catch (error: any) {
        if (error.response?.status === 401) {
          router.push('/host/login')
          return
        }
        logError('Failed to load RSVP settings:', error)
        showToast(getErrorMessage(error), 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [eventId, router, showToast])

  useEffect(() => {
    if (isPublic && subEventMode === 'ONE_TAP_ALL') {
      setSubEventMode('PER_SUBEVENT')
    }
  }, [isPublic, subEventMode])

  useEffect(() => {
    if (subEventMode === 'ONE_TAP_ALL') {
      setRequireSubEventSelection(false)
    }
  }, [subEventMode])

  const showPerSubeventOptions = activeMode === 'sub_event' && (isPublic || subEventMode === 'PER_SUBEVENT')

  const metadata = useMemo(() => (event?.custom_fields_metadata || {}) as Record<string, any>, [event])
  const persistedMode = event?.rsvp_experience_mode || 'standard'
  const modeSwitchLocked = Boolean(event?.mode_switch_locked)
  const modeDirty = persistedMode !== activeMode
  const showCapacityField = activeMode === 'standard' || activeMode === 'auto_confirm'

  const publicSubEventGuestCopy = requireSubEventSelection
    ? 'Anyone with the link chooses sessions first, then answers Yes / No / Maybe. A Yes requires at least one session.'
    : 'Anyone with the link chooses sessions first, then answers Yes / No / Maybe. Session selection is optional.'
  const publicSubEventHostCopy = requireSubEventSelection
    ? 'Guests pick sessions first, then answer Yes / No / Maybe. A Yes requires at least one session. Only sub-events marked public-visible appear—set that on the Sub-events page.'
    : 'Guests pick sessions first, then answer Yes / No / Maybe. Session selection is optional. Only sub-events marked public-visible appear—set that on the Sub-events page.'

  const contextualHint = useMemo(() => {
    if (activeMode === 'standard') {
      return isPublic
        ? 'Anyone with the link can RSVP with one Yes / No / Maybe for the whole event—no guest list.'
        : 'Invited guests verify by phone, then answer Yes / No / Maybe once for the whole event.'
    }
    if (activeMode === 'auto_confirm') {
      return isPublic
        ? 'Anyone with the link can submit the form; that counts as attending—no Yes / No / Maybe step.'
        : 'Invited guests verify by phone; submitting the form counts as attending—no Yes / No / Maybe step.'
    }
    if (activeMode === 'slot_based') {
      return isPublic
        ? 'Anyone with the link picks an available time slot to attend, or says they won\'t come; each slot has a limited number of seats.'
        : 'Invited guests verify by phone, then pick an available slot or say they won\'t come; each slot has a limited number of seats.'
    }
    if (subEventMode === 'ONE_TAP_ALL') {
      return isPublic
        ? 'Open link guests answer once for the main event only—sub-events are not shown on the RSVP form.'
        : 'Invited guests verify by phone; one Yes / No / Maybe applies to every sub-event assigned on their invite.'
    }
    return isPublic ? publicSubEventGuestCopy : requireSubEventSelection
      ? 'Invited guests verify by phone, choose sessions first, then answer Yes / No / Maybe. A Yes requires at least one session.'
      : 'Invited guests verify by phone, choose sessions first, then answer Yes / No / Maybe.'
  }, [activeMode, isPublic, subEventMode, publicSubEventGuestCopy, requireSubEventSelection])

  const slotReadinessReasonsText = (event?.rsvp_mode_readiness?.reasons || []).join(' ').toLowerCase()
  const slotFixText = slotReadinessReasonsText.includes('paused')
    ? 'Activate bookings in Slot Settings'
    : slotReadinessReasonsText.includes('active slot')
      ? 'Add active slots in Slot Settings'
      : 'Fix in Slot Settings'

  const getModeActionLink = (mode: 'standard' | 'sub_event' | 'slot_based' | 'auto_confirm') => {
    if (!eventId) return null
    if (mode === 'sub_event') return `/host/events/${eventId}/sub-events`
    if (mode === 'slot_based') return `/host/events/${eventId}/slot-booking`
    return null
  }

  const handleSave = async () => {
    if (!eventId || !event) return
    setSaveError('')
    if (modeDirty && !modeSwitchLocked) {
      const confirmed = window.confirm(
        'Switching RSVP mode changes the guest RSVP experience for this event. Continue?'
      )
      if (!confirmed) return
    }
    setSaving(true)
    try {
      const eventPayload: Record<string, any> = {
        rsvp_experience_mode: activeMode,
        is_public: isPublic,
      }
      if (showCapacityField) {
        const trimmed = rsvpTotalCapacity.trim()
        if (trimmed === '') {
          eventPayload.rsvp_total_capacity = null
          eventPayload.rsvp_block_on_full_capacity = false
        } else {
          const parsed = parseInt(trimmed, 10)
          if (!Number.isFinite(parsed) || parsed < 1) {
            setSaveError('Total capacity must be a positive whole number, or left blank.')
            setSaving(false)
            return
          }
          eventPayload.rsvp_total_capacity = parsed
          eventPayload.rsvp_block_on_full_capacity = blockOnFullCapacity
        }
      } else {
        eventPayload.rsvp_total_capacity = null
        eventPayload.rsvp_block_on_full_capacity = false
      }
      if (activeMode === 'sub_event') {
        eventPayload.rsvp_mode = isPublic ? 'PER_SUBEVENT' : subEventMode
        const perSubevent = isPublic || subEventMode === 'PER_SUBEVENT'
        eventPayload.rsvp_require_sub_event_selection = perSubevent && requireSubEventSelection
      } else {
        eventPayload.rsvp_require_sub_event_selection = false
      }
      const eventResponse = await api.patch(`/api/events/${eventId}/`, eventPayload)
      const updatedEvent = eventResponse.data as Event
      setEvent(updatedEvent)

      const base: InviteConfig = (pageConfig || (event.page_config as any) || { themeId: 'classic-noir' }) as any
      const next: InviteConfig = {
        ...(base as any),
        themeId: (base as any).themeId || 'classic-noir',
        rsvpForm: (rsvpForm as any) || { version: 1 },
      }

      await api.put(`/api/events/${eventId}/design/`, { page_config: next })
      setPageConfig(next)
      showToast('RSVP form settings saved', 'success')
      if (
        activeMode === 'slot_based' &&
        !updatedEvent?.rsvp_mode_readiness?.ready
      ) {
        const noSlotsReason = (updatedEvent.rsvp_mode_readiness?.reasons || []).find((r) =>
          r.toLowerCase().includes('slot')
        )
        showToast(
          noSlotsReason || 'Slot-based RSVP saved, but no slots are available yet.',
          'info'
        )
      }
    } catch (error: any) {
      logError('Failed to save RSVP settings:', error)
      const backendError =
        error?.response?.data?.rsvp_experience_mode?.[0] ||
        error?.response?.data?.rsvp_experience_mode ||
        error?.response?.data?.error ||
        ''
      if (backendError) {
        setSaveError(String(backendError))
      }
      showToast(getErrorMessage(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <p className="text-gray-600">Event not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Link href={`/event/${event.slug}/rsvp`} target="_blank">
                <Button variant="outline" size="sm" className="border-eco-green text-eco-green hover:bg-eco-green-light">
                  Preview RSVP Page
                </Button>
              </Link>
              <Button
                onClick={handleSave}
                disabled={saving || !event.has_rsvp}
                size="sm"
                className="bg-eco-green hover:bg-eco-green-dark text-white"
              >
                {saving ? 'Saving…' : modeDirty ? 'Save RSVP Settings (Unsaved mode change)' : 'Save RSVP Settings'}
              </Button>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-eco-green">RSVP Settings</h1>
            <p className="text-sm text-gray-600 mt-1">
              Control who can respond and how they respond to your event.
            </p>
          </div>
        </div>

        {!event.has_rsvp && (
          <Card className="bg-white border-2 border-yellow-200 mb-6">
            <CardHeader>
              <CardTitle className="text-yellow-800">RSVP is disabled</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">
                Enable RSVP from <strong>Event Features</strong> on the event dashboard to edit the RSVP form.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="bg-white border-2 border-eco-green-light mb-6">
          <CardHeader>
            <CardTitle className="text-eco-green">Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">Who can respond to this event?</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                className={`rounded-md border p-3 cursor-pointer ${!isPublic ? 'border-eco-green bg-eco-green-light/40' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="access_selector"
                    checked={!isPublic}
                    onChange={() => setIsPublic(false)}
                  />
                  <span className="font-medium text-sm">Invited guests only</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  Guests must verify their phone number. Only people on your guest list can RSVP or access the host catalog.
                </p>
              </label>
              <label
                className={`rounded-md border p-3 cursor-pointer ${isPublic ? 'border-eco-green bg-eco-green-light/40' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="access_selector"
                    checked={isPublic}
                    onChange={() => setIsPublic(true)}
                  />
                  <span className="font-medium text-sm">Anyone with the link</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  No phone verification required. Anyone who has your invite link can view the event and RSVP.
                </p>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-2 border-eco-green-light">
          <CardHeader>
            <CardTitle className="text-eco-green">Response Type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">How do guests respond?</p>
            {modeSwitchLocked && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-medium">RSVP mode is locked</p>
                <p className="mt-1 text-xs text-amber-900/90">
                  You cannot switch modes after guests have submitted RSVPs or confirmed slot bookings. You can still
                  edit form fields and settings for the current mode.
                </p>
                {!!event?.mode_switch_lock_reasons?.length && (
                  <ul className="mt-2 list-disc pl-5 text-xs text-amber-900/90">
                    {event.mode_switch_lock_reasons.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                className={`rounded-md border p-3 ${
                  modeSwitchLocked && persistedMode !== 'standard'
                    ? 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer'
                } ${activeMode === 'standard' ? 'border-eco-green bg-eco-green-light/40' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="rsvp_mode_selector"
                    checked={activeMode === 'standard'}
                    disabled={modeSwitchLocked && persistedMode !== 'standard'}
                    onChange={() => setActiveMode('standard')}
                  />
                  <span className="font-medium">Yes / No / Maybe</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">Guests give a single attendance answer for the whole event.</p>
                <p className="mt-1 text-[11px] font-medium text-gray-700">{activeMode === 'standard' ? 'Selected' : 'Not selected'}</p>
              </label>
              <label
                className={`rounded-md border p-3 ${
                  modeSwitchLocked && persistedMode !== 'sub_event'
                    ? 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer'
                } ${activeMode === 'sub_event' ? 'border-eco-green bg-eco-green-light/40' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="rsvp_mode_selector"
                    checked={activeMode === 'sub_event'}
                    disabled={modeSwitchLocked && persistedMode !== 'sub_event'}
                    onChange={() => setActiveMode('sub_event')}
                  />
                  <span className="font-medium">Sub-event / session</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">Guests respond separately for each sub-event or session.</p>
                <p className="mt-1 text-[11px] font-medium text-gray-700">{activeMode === 'sub_event' ? 'Selected' : 'Not selected'}</p>
              </label>
              <label
                className={`rounded-md border p-3 ${
                  modeSwitchLocked && persistedMode !== 'slot_based'
                    ? 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer'
                } ${activeMode === 'slot_based' ? 'border-eco-green bg-eco-green-light/40' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="rsvp_mode_selector"
                    checked={activeMode === 'slot_based'}
                    disabled={modeSwitchLocked && persistedMode !== 'slot_based'}
                    onChange={() => setActiveMode('slot_based')}
                  />
                  <span className="font-medium">Pick a time slot</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">Guests book a specific date and time to attend.</p>
                <p className="mt-1 text-[11px] font-medium text-gray-700">{activeMode === 'slot_based' ? 'Selected' : 'Not selected'}</p>
              </label>
              <label
                className={`rounded-md border p-3 ${
                  modeSwitchLocked && persistedMode !== 'auto_confirm'
                    ? 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer'
                } ${activeMode === 'auto_confirm' ? 'border-eco-green bg-eco-green-light/40' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="rsvp_mode_selector"
                    checked={activeMode === 'auto_confirm'}
                    disabled={modeSwitchLocked && persistedMode !== 'auto_confirm'}
                    onChange={() => setActiveMode('auto_confirm')}
                  />
                  <span className="font-medium">Confirm attendance</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">Submitting the form confirms the guest immediately. No yes / no question is shown.</p>
                <p className="mt-1 text-[11px] font-medium text-gray-700">{activeMode === 'auto_confirm' ? 'Selected' : 'Not selected'}</p>
              </label>
            </div>

            {saveError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {saveError}
              </div>
            )}

            {activeMode === 'sub_event' && (
              <div className="rounded-md border p-3 space-y-3">
                <p className="text-sm font-medium text-gray-700">How do guests respond to sub-events?</p>
                {isPublic ? (
                  <p className="text-sm text-gray-600">{publicSubEventHostCopy}</p>
                ) : (
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="sub_event_mode_selector"
                        checked={subEventMode === 'ONE_TAP_ALL'}
                        onChange={() => setSubEventMode('ONE_TAP_ALL')}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="font-medium">One response confirms all sub-events</span>
                        <p className="text-xs text-gray-600 mt-0.5">
                          A single yes/no/maybe automatically applies to every sub-event they are assigned to.
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="sub_event_mode_selector"
                        checked={subEventMode === 'PER_SUBEVENT'}
                        onChange={() => setSubEventMode('PER_SUBEVENT')}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="font-medium">Guests choose which sub-events to attend</span>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Guests see a checklist of sub-events and confirm each one individually.
                        </p>
                      </div>
                    </label>
                  </div>
                )}
                {showPerSubeventOptions && (
                  <label className="flex items-start gap-2 text-sm cursor-pointer rounded-md border border-gray-200 bg-gray-50 p-3">
                    <input
                      type="checkbox"
                      checked={requireSubEventSelection}
                      onChange={(e) => setRequireSubEventSelection(e.target.checked)}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="font-medium">Require at least one session for Yes</span>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Guests can skip sessions if they answer No or Maybe, but a Yes requires at least one session.
                      </p>
                    </div>
                  </label>
                )}
                <Link href={`/host/events/${eventId}/sub-events`} className="inline-block text-sm text-eco-green hover:underline">
                  Manage sub-events
                </Link>
              </div>
            )}

            {activeMode === 'slot_based' && (
              <div className="rounded-md border p-3">
                <p className="text-sm text-gray-700">
                  Guests confirm attendance by booking a slot, or they can explicitly decline.
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Keep slot availability updated before sharing RSVP links.
                </p>
                <div className="mt-2">
                  <Link href={`/host/events/${eventId}/slot-booking`}>
                    <Button variant="outline" size="sm" className="border-eco-green text-eco-green hover:bg-eco-green-light">
                      Open Slot Settings
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {!!event?.rsvp_mode_readiness && !event.rsvp_mode_readiness.ready && (
              <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-sm font-medium text-yellow-900">Setup incomplete</p>
                {!!event.rsvp_mode_readiness.reasons?.length && (
                  <ul className="mt-1 list-disc pl-5 text-xs text-gray-700">
                    {event.rsvp_mode_readiness.reasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                )}
                {!!getModeActionLink(activeMode) && (
                  <Link href={getModeActionLink(activeMode) as string} className="mt-2 inline-block text-xs font-medium text-eco-green hover:underline">
                    {activeMode === 'sub_event' ? 'Fix in Sub-events' : slotFixText}
                  </Link>
                )}
              </div>
            )}

            <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
              {contextualHint}
            </div>
          </CardContent>
        </Card>

        {showCapacityField && (
          <Card className="bg-white border-2 border-eco-green-light mb-6">
            <CardHeader className="pb-3">
              <button
                type="button"
                onClick={() => setCapacitySectionOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={capacitySectionOpen}
              >
                <div>
                  <CardTitle className="text-eco-green">Total capacity</CardTitle>
                  {!capacitySectionOpen && rsvpTotalCapacity.trim() ? (
                    <p className="mt-1 text-sm text-gray-600">
                      {rsvpTotalCapacity} max attendees
                      {blockOnFullCapacity ? ' · blocking when full' : ''}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-gray-500">Optional attendance cap</p>
                  )}
                </div>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-gray-500 transition-transform ${capacitySectionOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </CardHeader>
            {capacitySectionOpen && (
              <CardContent className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-600">
                  Cap how many guests can confirm attendance. Declines do not use a spot. Leave blank for no limit.
                </p>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
                  <div className="max-w-xs flex-1">
                    <label htmlFor="rsvp_total_capacity" className="mb-1 block text-sm font-medium text-gray-700">
                      Maximum attendees
                    </label>
                    <input
                      id="rsvp_total_capacity"
                      type="number"
                      min={1}
                      inputMode="numeric"
                      placeholder="No limit"
                      value={rsvpTotalCapacity}
                      onChange={(e) => {
                        const next = e.target.value
                        setRsvpTotalCapacity(next)
                        if (!next.trim()) setBlockOnFullCapacity(false)
                      }}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-eco-green focus:outline-none focus:ring-1 focus:ring-eco-green"
                    />
                  </div>
                  <label
                    className={`flex items-start gap-2 pb-2 text-sm ${
                      rsvpTotalCapacity.trim() ? 'cursor-pointer text-gray-700' : 'cursor-not-allowed text-gray-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={blockOnFullCapacity}
                      disabled={!rsvpTotalCapacity.trim()}
                      onChange={(e) => setBlockOnFullCapacity(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>Block RSVP submissions on full capacity</span>
                  </label>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        <Card className="mt-6 bg-white border-2 border-eco-green-light">
          <CardHeader>
            <CardTitle className="text-eco-green">RSVP Form</CardTitle>
          </CardHeader>
          <CardContent>
            <RsvpFormEditor
              value={rsvpForm}
              onChange={setRsvpForm}
              customFieldsMetadata={metadata}
              activeMode={activeMode}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

