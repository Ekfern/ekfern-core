'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logError, logDebug } from '@/lib/error-handler'
import WizardProgress from '@/components/host/WizardProgress'
import EventDetailsForm, { type EventDetailsFormData } from '@/components/host/EventDetailsForm'
import CoHostInviteDraft from '@/components/host/CoHostInviteDraft'
import { inviteCoHost } from '@/lib/cohosts'

export default function NewEventPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  // Collected while the event does not exist yet; sent the moment it does.
  const [pendingCoHosts, setPendingCoHosts] = useState<string[]>([])

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
      // is_multi_sub_event is a UI-only routing flag — keep it out of the API payload.
      const { is_multi_sub_event, ...eventPayload } = data
      const response = await api.post('/api/events/', eventPayload)
      const eventId = response.data.id
      if (!eventId) {
        logError('Event ID not found in response:', response.data)
        showToast('Event created but ID not found. Please refresh the dashboard.', 'error')
        router.push('/host/dashboard')
        return
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
        <p className="text-lg text-gray-700 mb-8">Start with your basic details — you can add RSVP or a host catalog anytime.</p>
        <Card className="bg-white border-2 border-eco-green-light">
          <CardHeader>
            <CardTitle className="text-eco-green">Event Details</CardTitle>
          </CardHeader>
          <CardContent>
            <EventDetailsForm
              onSubmit={onSubmit}
              submitLabel="Next: Choose Layout"
              loading={loading}
              onCancel={() => router.back()}
              showStructureChoice
            />
            <p className="text-sm text-center text-gray-600 mt-4">
              You can enable RSVP or Registry later from your Dashboard.
            </p>
          </CardContent>
        </Card>

        <CoHostInviteDraft value={pendingCoHosts} onChange={setPendingCoHosts} />
      </div>
    </div>
  )
}
