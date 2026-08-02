'use client'

/**
 * Sub-events wizard step — the multi-sub-event branch of event creation.
 *
 * Reached from Event Details when the host picks "Multiple sub-events". Collects
 * just the essentials for each sub-event (name, start, end, location); creating
 * one auto-upgrades the event to ENVELOPE on the backend, which in turn makes the
 * canonical RSVP mode "sub-event". All the richer options — images, colours,
 * per-sub-event RSVP behaviour, public visibility — live on the dedicated
 * Sub-events management tab and RSVP Settings page and are intentionally left out
 * of this step.
 */

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logError } from '@/lib/error-handler'
import WizardProgress from '@/components/host/WizardProgress'
import { eventTzLocalToUtcISO } from '@/lib/datetime/eventTz'

interface SubEvent {
  id: number
  title: string
  start_at: string
  end_at?: string | null
  location: string
}

interface EventRecord {
  id: number
  title: string
  timezone?: string
}

const EMPTY_FORM = { title: '', start_at: '', end_at: '', location: '' }

export default function SubEventsSetupPage() {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()
  const eventId = params.eventId ? parseInt(params.eventId as string, 10) : 0

  const [event, setEvent] = useState<EventRecord | null>(null)
  const [subEvents, setSubEvents] = useState<SubEvent[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const eventTimezone = event?.timezone || 'Asia/Kolkata'

  useEffect(() => {
    if (!eventId || Number.isNaN(eventId)) {
      router.push('/host/dashboard')
      return
    }
    const load = async () => {
      try {
        const [eventResp, subResp] = await Promise.all([
          api.get(`/api/events/${eventId}/`),
          api.get(`/api/events/envelopes/${eventId}/sub-events/`).catch((err) => {
            // Event may not be ENVELOPE yet (no sub-events created) — treat as empty.
            if (err.response?.status === 404) return { data: [] }
            throw err
          }),
        ])
        setEvent(eventResp.data)
        setSubEvents(subResp.data.results || subResp.data || [])
      } catch (error: any) {
        if (error.response?.status === 401) {
          router.push('/host/login')
          return
        }
        logError('Failed to load sub-events setup:', error)
        showToast(getErrorMessage(error), 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [eventId, router, showToast])

  const refreshSubEvents = async () => {
    try {
      const resp = await api.get(`/api/events/envelopes/${eventId}/sub-events/`)
      setSubEvents(resp.data.results || resp.data || [])
    } catch (error: any) {
      if (error.response?.status !== 404) {
        logError('Failed to refresh sub-events:', error)
      }
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.start_at) {
      showToast('A name and start time are required for each sub-event.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        start_at: eventTzLocalToUtcISO(form.start_at, eventTimezone),
        end_at: form.end_at ? eventTzLocalToUtcISO(form.end_at, eventTimezone) : null,
        location: form.location.trim(),
      }
      await api.post(`/api/events/envelopes/${eventId}/sub-events/`, payload)
      showToast('Sub-event added', 'success')
      setForm(EMPTY_FORM)
      await refreshSubEvents()
    } catch (error: any) {
      logError('Failed to add sub-event:', error)
      showToast(getErrorMessage(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (subEventId: number) => {
    if (!confirm('Remove this sub-event?')) return
    try {
      await api.delete(`/api/events/sub-events/${subEventId}/`)
      showToast('Sub-event removed', 'success')
      await refreshSubEvents()
    } catch (error: any) {
      logError('Failed to remove sub-event:', error)
      showToast(getErrorMessage(error), 'error')
    }
  }

  const formatDateTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: eventTimezone,
      })
    } catch {
      return dateString
    }
  }

  const goToLayout = () => router.push(`/host/events/${eventId}/layout`)

  if (loading) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      <WizardProgress currentStep="sub-events" eventId={eventId} includeSubEvents />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-4xl font-bold mb-2 text-eco-green">Add Your Sub-events</h1>
        <p className="text-lg text-gray-700 mb-6">
          Add each event that&apos;s part of {event?.title || 'your event'}. Give each one a name,
          time, and place — you need at least one to continue.
        </p>

        {/* Existing sub-events */}
        {subEvents.length > 0 && (
          <div className="space-y-2 mb-6">
            {subEvents.map((se) => (
              <div
                key={se.id}
                className="flex items-center justify-between gap-3 rounded-md border border-eco-green-light bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{se.title}</p>
                  <p className="text-xs text-gray-600">
                    {formatDateTime(se.start_at)}
                    {se.end_at ? ` – ${formatDateTime(se.end_at)}` : ''}
                    {se.location ? ` · ${se.location}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(se.id)}
                  className="text-sm text-red-600 hover:underline flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        <Card className="bg-white border-2 border-eco-green-light mb-6">
          <CardHeader>
            <CardTitle className="text-eco-green">
              {subEvents.length === 0 ? 'Add your first sub-event' : 'Add another sub-event'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Sub-event name</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Name this event"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Starts</label>
                  <Input
                    type="datetime-local"
                    value={form.start_at}
                    onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Ends (optional)</label>
                  <Input
                    type="datetime-local"
                    value={form.end_at}
                    onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Location (optional)</label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Venue or address"
                />
              </div>
              <p className="text-xs text-gray-500">
                Times are in the event timezone ({eventTimezone}).
              </p>
              <Button
                type="submit"
                disabled={saving}
                variant="outline"
                className="border-eco-green text-eco-green hover:bg-eco-green-light"
              >
                {saving ? 'Adding…' : '+ Add sub-event'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Deferred-options note */}
        <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900 mb-6">
          Just the basics for now. You can set how guests RSVP to each sub-event, plus images,
          colours, and public visibility, anytime from the{' '}
          <Link href={`/host/events/${eventId}/sub-events`} className="font-medium underline">
            Sub-events tab
          </Link>{' '}
          and{' '}
          <Link href={`/host/events/${eventId}/rsvp`} className="font-medium underline">
            RSVP Settings
          </Link>
          .
        </div>

        {/* Nav */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/host/events/${eventId}/details`)}
            className="flex-1 border-eco-green text-eco-green hover:bg-eco-green-light"
          >
            Back
          </Button>
          <Button
            type="button"
            onClick={goToLayout}
            disabled={subEvents.length === 0}
            className="flex-1 bg-eco-green hover:bg-eco-green-dark text-white"
          >
            Next: Choose Layout
          </Button>
        </div>
        {subEvents.length === 0 && (
          <p className="text-xs text-center text-gray-500 mt-2">
            Add at least one sub-event to continue.
          </p>
        )}
      </div>
    </div>
  )
}
