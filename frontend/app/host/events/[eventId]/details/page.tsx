'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logError } from '@/lib/error-handler'
import WizardProgress from '@/components/host/WizardProgress'
import EventDetailsForm, { type EventDetailsFormData } from '@/components/host/EventDetailsForm'
import { getInvitePage, updateInvitePage } from '@/lib/invite/api'
import { getEventPageConfig, updateEventPageConfig } from '@/lib/event/api'
import type { EventDetailsTileSettings, InviteConfig, Tile } from '@/lib/invite/schema'

interface EventRecord extends EventDetailsFormData {
  id: number
}

function normalizeListResponse(payload: unknown): Array<{ will_attend?: string }> {
  if (Array.isArray(payload)) return payload
  const obj = payload as { results?: unknown; items?: unknown; data?: unknown } | undefined
  if (Array.isArray(obj?.results)) return obj!.results as Array<{ will_attend?: string }>
  if (Array.isArray(obj?.items)) return obj!.items as Array<{ will_attend?: string }>
  if (Array.isArray(obj?.data)) return obj!.data as Array<{ will_attend?: string }>
  return []
}

export default function EventDetailsEditPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId ? parseInt(params.eventId as string, 10) : 0
  const { showToast } = useToast()

  const [event, setEvent] = useState<EventRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [pendingData, setPendingData] = useState<EventDetailsFormData | null>(null)
  const [rsvpWarningCount, setRsvpWarningCount] = useState<number | null>(null)

  useEffect(() => {
    if (!eventId || isNaN(eventId)) return
    api
      .get(`/api/events/${eventId}/`)
      .then((res) => setEvent(res.data))
      .catch((err: unknown) => {
        logError('EventDetailsEditPage: failed to load event', err)
        showToast('Failed to load event.', 'error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  async function resyncEventDetailsTile(date?: string, city?: string): Promise<void> {
    try {
      const patchTiles = (tiles: Tile[]): Tile[] =>
        tiles.map((t) => {
          if (t.type !== 'event-details') return t
          const settings = t.settings as EventDetailsTileSettings
          return {
            ...t,
            settings: {
              ...settings,
              date: date ?? settings.date,
              location: city ?? settings.location,
            },
          }
        })

      // Event.page_config and InvitePage.config are two separate stores that must be
      // kept in sync (Page Editor reads from the former; publish reads from the latter —
      // same dual-write the Layout step already does when applying a layout).
      const pageConfig = await getEventPageConfig(eventId)
      if (pageConfig?.page_config?.tiles) {
        const updated: InviteConfig = { ...pageConfig.page_config, tiles: patchTiles(pageConfig.page_config.tiles) }
        await updateEventPageConfig(eventId, updated)
      }

      const invitePage = await getInvitePage(eventId)
      if (invitePage?.config?.tiles) {
        const updated: InviteConfig = { ...invitePage.config, tiles: patchTiles(invitePage.config.tiles) }
        await updateInvitePage(eventId, { config: updated })
      }
    } catch (err) {
      // Non-fatal — the Event itself already saved; the tile just needs a manual fix in Page Editor.
      logError('EventDetailsEditPage: tile resync failed', err)
    }
  }

  async function saveChanges(data: EventDetailsFormData): Promise<void> {
    setLoading(true)
    try {
      await api.patch(`/api/events/${eventId}/`, data)
      if (data.date !== event?.date || data.city !== event?.city) {
        await resyncEventDetailsTile(data.date, data.city)
      }
      showToast('Event details updated.', 'success')
      // This page has exactly one entry point app-wide: the wizard stepper's
      // step-1 link. So saving should always continue the wizard, same as
      // /host/events/new does — never dead-end the user at the dashboard.
      router.push(`/host/events/${eventId}/layout`)
    } catch (err: unknown) {
      logError('EventDetailsEditPage: save failed', err)
      showToast(getErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(data: EventDetailsFormData): Promise<void> {
    const dateChanged = !!event && data.date !== event.date
    if (dateChanged) {
      try {
        const res = await api.get(`/api/events/${eventId}/rsvps/`)
        const rsvps = normalizeListResponse(res.data)
        const attendingCount = rsvps.filter((r) => r.will_attend === 'yes').length
        if (attendingCount > 0) {
          setPendingData(data)
          setRsvpWarningCount(attendingCount)
          return
        }
      } catch {
        // No RSVPs yet, or fetch failed — proceed without the warning.
      }
    }
    await saveChanges(data)
  }

  if (!eventId || isNaN(eventId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-eco-beige">
        <p className="text-red-500">Invalid event ID.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      <WizardProgress currentStep={1} eventId={eventId} />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-4xl font-bold mb-2 text-eco-green">Edit Event Details</h1>
        <p className="text-lg text-gray-700 mb-8">Update your event&apos;s basic details.</p>
        <Card className="bg-white border-2 border-eco-green-light">
          <CardHeader>
            <CardTitle className="text-eco-green">Event Details</CardTitle>
          </CardHeader>
          <CardContent>
            {event && (
              <EventDetailsForm
                defaultValues={event}
                onSubmit={handleSubmit}
                submitLabel="Save changes"
                loading={loading}
                onCancel={() => router.back()}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {pendingData && rsvpWarningCount !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-eco-green">Change the event date?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-700">
                <strong className="text-orange-600">{rsvpWarningCount}</strong> guest{rsvpWarningCount === 1 ? '' : 's'} already RSVP&apos;d yes to the current date. Changing it won&apos;t notify them automatically.
              </p>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPendingData(null)
                    setRsvpWarningCount(null)
                  }}
                  className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    const data = pendingData
                    setPendingData(null)
                    setRsvpWarningCount(null)
                    if (data) await saveChanges(data)
                  }}
                  className="flex-1 bg-eco-green hover:bg-eco-green-dark text-white"
                >
                  Change date anyway
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
