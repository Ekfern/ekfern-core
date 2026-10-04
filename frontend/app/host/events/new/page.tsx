'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logError, logDebug } from '@/lib/error-handler'
import WizardProgress from '@/components/host/WizardProgress'
import EventDetailsForm, { eventPayloadOf, type EventDetailsFormData } from '@/components/host/EventDetailsForm'
import CoHostInviteDraft from '@/components/host/CoHostInviteDraft'
import { inviteCoHost } from '@/lib/cohosts'
import { countryForZone, deviceTimeZone } from '@/lib/eventTimezone'
import { updateEventPageConfig } from '@/lib/event/api'
import { visibleItems } from '@/lib/invite/goodToKnow'
import type { InviteConfig } from '@/lib/invite/schema'

/**
 * What the host typed for the invitation itself - the time, the venue, Good to
 * know - as a starter invitation. There is no layout yet; applying one carries
 * this content into it (lib/invite/tileContent.ts), so nothing is typed twice.
 * Null when there is nothing beyond what the event already holds.
 */
function starterInvitation(data: EventDetailsFormData): InviteConfig | null {
  const goodToKnow = visibleItems(data.good_to_know)
  // Several events take their own date, time and place; only Good to know,
  // which is for the whole celebration, goes on the invitation itself.
  const single = !data.is_multi_sub_event
  const time = single ? data.time : ''
  const venue = single && data.where_mode === 'in-person' ? data.venue?.trim() : ''
  if (!time && !venue && goodToKnow.length === 0) return null
  const city = single && data.where_mode === 'in-person' ? data.city?.trim() : ''
  return {
    tiles: [
      { id: 'tile-title-start', type: 'title', enabled: true, order: 0, settings: { text: data.title } },
      {
        id: 'tile-event-details-start',
        type: 'event-details',
        enabled: true,
        order: 1,
        settings: {
          date: single ? (data.date ?? '') : '',
          ...(time ? { time } : {}),
          location: [venue, city].filter(Boolean).join(', '),
          ...(goodToKnow.length ? { goodToKnow } : {}),
        },
      },
    ],
  } as InviteConfig
}

export default function NewEventPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  // Collected while the event does not exist yet; sent the moment it does.
  const [pendingCoHosts, setPendingCoHosts] = useState<string[]>([])
  // Start from where the host is: their device's zone, and the country it belongs to.
  // Read after mount - the server renders this page too, in its own zone, and
  // the two disagreeing breaks hydration.
  const [defaults, setDefaults] = useState<{ timezone: string; country: string } | null>(null)
  useEffect(() => {
    const timezone = deviceTimeZone()
    setDefaults({ timezone, country: countryForZone(timezone) ?? 'IN' })
  }, [])

  /**
   * Send the invites gathered during creation.
   *
   * Never allowed to block: by this point the event exists, and stranding the
   * host on a failed invite would be far worse than the invite not going out.
   * Anything that fails is named, and can be re-sent from Edit Event Details.
   */
  const sendPendingCoHostInvites = async (eventId: number | string) => {
    if (pendingCoHosts.length === 0) return
    // In parallel, not in sequence: the invite endpoint sends its email inside
    // the request, so sequential sends would make the host wait for the sum of
    // five SES round trips before the next step loads.
    const results = await Promise.allSettled(
      pendingCoHosts.map((email) => inviteCoHost(eventId, email)),
    )
    const failed = pendingCoHosts.filter((_, i) => results[i].status === 'rejected')
    results.forEach((r) => {
      if (r.status === 'rejected') logError('Co-host invite after event creation failed', r.reason)
    })
    const sent = pendingCoHosts.length - failed.length
    if (sent > 0) {
      showToast(`${sent} co-host invite${sent === 1 ? '' : 's'} sent.`, 'success')
    }
    if (failed.length > 0) {
      showToast(
        `Couldn't invite ${failed.join(', ')}. Add them from Edit Event Details.`,
        'error',
      )
    }
  }

  const onSubmit = async (data: EventDetailsFormData) => {
    setLoading(true)
    try {
      const is_multi_sub_event = data.is_multi_sub_event
      const response = await api.post('/api/events/', eventPayloadOf(data))
      const eventId = response.data.id
      if (!eventId) {
        logError('Event ID not found in response:', response.data)
        showToast('Event created but ID not found. Please refresh the dashboard.', 'error')
        router.push('/host/dashboard')
        return
      }
      const starter = starterInvitation(data)
      if (starter) {
        try {
          await updateEventPageConfig(eventId, starter)
        } catch (err) {
          // Never strands the host: the event exists, and the time and venue can
          // still be typed into Event Details in the editor.
          logError('Starter invitation save failed', err)
        }
      }
      await sendPendingCoHostInvites(eventId)

      if (is_multi_sub_event) {
        logDebug('Event created, navigating to sub-events step:', eventId)
        showToast('Event created! Now add your sub-events.', 'success')
        setTimeout(() => {
          router.push(`/host/events/${eventId}/sub-events-setup`)
        }, 100)
        return
      }
      logDebug('Event created successfully, navigating to layout step:', eventId)
      showToast('Event created! Now let\'s pick a page layout.', 'success')
      setTimeout(() => {
        router.push(`/host/events/${eventId}/layout`)
      }, 100)
    } catch (error: unknown) {
      logError('Event creation error:', error)
      showToast(getErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      <WizardProgress currentStep="details" />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-4xl font-bold mb-2 text-eco-green">Create Your Event</h1>
        <p className="text-lg text-gray-700 mb-8">What guests need to know, and how the event runs.</p>
        <Card className="bg-white border-2 border-eco-green-light">
          <CardContent className="pt-6">
            {defaults && <EventDetailsForm
              defaultValues={defaults}
              onSubmit={onSubmit}
              submitLabel="Next: Choose Layout"
              loading={loading}
              onCancel={() => router.back()}
              showStructureChoice
              showInviteContent
              coHosts={{
                count: pendingCoHosts.length,
                panel: <CoHostInviteDraft value={pendingCoHosts} onChange={setPendingCoHosts} />,
              }}
            />}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
