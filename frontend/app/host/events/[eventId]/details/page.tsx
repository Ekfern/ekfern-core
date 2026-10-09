'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logError } from '@/lib/error-handler'
import WizardProgress from '@/components/host/WizardProgress'
import EventDetailsForm, { eventPayloadOf, type EventDetailsFormData } from '@/components/host/EventDetailsForm'
import { listCoHosts, type EventRole } from '@/lib/cohosts'
import { getInvitePage, updateInvitePage } from '@/lib/invite/api'
import { getEventPageConfig, updateEventPageConfig } from '@/lib/event/api'
import type { InviteConfig } from '@/lib/invite/schema'
import { completedSteps, invitationOf, nextStepAfter, type WizardEvent } from '@/lib/host/wizardSteps'
import {
  changedContent,
  invitationIsLaidOut,
  readEventDetailsContent,
  withEventDetailsContent,
  type EventDetailsContent,
} from '@/lib/invite/eventDetailsContent'

interface EventRecord extends EventDetailsFormData {
  id: number
  event_structure?: 'SIMPLE' | 'ENVELOPE'
  /** 'owner' for the host, 'cohost' for a collaborator. */
  my_role?: EventRole
  page_config?: InviteConfig | null
  invite_page_summary?: WizardEvent['invite_page_summary']
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
  // For Backstage's "2 co-hosts · Manage" link; co-hosts are managed on Overview.
  const [coHostCount, setCoHostCount] = useState(0)
  // What the invitation says now - time, location line, Good to know - so the
  // form starts from it and a save writes back only what changed.
  //
  // The invitation lives in two stores. Older events can hold their design only
  // in the InvitePage draft with an empty page_config, so read whichever has
  // tiles - judging by page_config alone took such an event for one with no
  // invitation and wrote a two-tile starter over its design.
  const currentInvitation = useMemo(() => invitationOf(event), [event])
  const invitationContent = useMemo(() => readEventDetailsContent(currentInvitation), [currentInvitation])
  // Once laid out, the invitation is where its time, venue line and Good to know
  // are edited; here they show greyed out. The date stays here: it is the event's.
  const invitationLocked = invitationIsLaidOut(currentInvitation)
  // Steps already done are skipped on the way forward (lib/host/wizardSteps.ts).
  const done = event ? completedSteps(event) : null
  const forwardLabel = done?.layout ? 'Save and return to editor' : 'Save and choose layout'

  useEffect(() => {
    if (event?.my_role !== 'owner') return
    listCoHosts(eventId)
      .then((all) => setCoHostCount(all.filter((c) => c.status === 'pending' || c.status === 'accepted').length))
      .catch(() => { /* the link still works; it just shows no count */ })
  }, [event?.my_role, eventId])

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

  /**
   * Write the invitation's own content - date, time, location line, Good to
   * know - into its Event Details tile, only the parts that changed.
   *
   * Event.page_config and InvitePage.config are two separate stores that must be
   * kept in sync (Page Editor reads from the former; publish reads from the latter -
   * same dual-write the Layout step already does when applying a layout).
   */
  async function writeInvitationContent(patch: EventDetailsContent & { date?: string }, title: string): Promise<void> {
    if (Object.keys(patch).length === 0) return
    try {
      const pageConfig = (await getEventPageConfig(eventId))?.page_config
      const invitePage = await getInvitePage(eventId)
      // Patch the design wherever it is; an empty page_config takes the draft's.
      const base = pageConfig?.tiles?.length ? pageConfig : invitePage?.config?.tiles?.length ? invitePage.config : pageConfig
      const nextPageConfig = withEventDetailsContent(base, patch, title)
      if (nextPageConfig) await updateEventPageConfig(eventId, nextPageConfig)

      // Only an invitation that already has the tile; a starter lives in page_config.
      if (invitePage?.config?.tiles?.some((t) => t.type === 'event-details')) {
        const nextInvite = withEventDetailsContent(invitePage.config, patch, title)
        if (nextInvite) await updateInvitePage(eventId, { config: nextInvite })
      }
    } catch (err) {
      // Non-fatal — the Event itself already saved; the tile can be fixed in Page Editor.
      logError('EventDetailsEditPage: invitation update failed', err)
      showToast('Event saved, but the invitation could not be updated. Check it in the Page Editor.', 'error')
    }
  }

  /** `then`: where to go once saved - the messages page, when the host chose to tell guests of a new date. */
  async function saveChanges(data: EventDetailsFormData, then?: string): Promise<void> {
    setLoading(true)
    try {
      // is_multi_sub_event is a create-flow-only routing flag; not persisted here.
      const is_multi_sub_event = data.is_multi_sub_event
      const eventPayload = eventPayloadOf(data)
      await api.patch(`/api/events/${eventId}/`, eventPayload)
      const patch: EventDetailsContent & { date?: string } = invitationLocked
        ? {}
        : changedContent(invitationContent, {
            time: is_multi_sub_event ? invitationContent.time : data.time,
            location: is_multi_sub_event ? invitationContent.location : data.venue,
            goodToKnow: data.good_to_know,
          })
      if (eventPayload.date && eventPayload.date !== event?.date) patch.date = eventPayload.date
      await writeInvitationContent(patch, eventPayload.title)
      showToast('Event details updated.', 'success')
      // On to the first step still to do; once laid out, straight back to the editor.
      router.push(then ?? nextStepAfter('details', event!, is_multi_sub_event))
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
      <WizardProgress
        currentStep="details"
        eventId={eventId}
        includeSubEvents={event?.event_structure === 'ENVELOPE'}
      />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-4xl font-bold mb-6 text-eco-green">Edit Event Details</h1>
        <Card className="bg-white border-2 border-eco-green-light">
          <CardContent className="pt-6">
            {event && (
              <EventDetailsForm
                defaultValues={{
                  ...event,
                  // Seed the fork from the event's current structure so a
                  // multi-sub-event (ENVELOPE) event shows "multiple sub-events"
                  // selected instead of defaulting to single.
                  // A last day means several events too: the host chose that before
                  // adding any sub-events, which is what ENVELOPE waits for.
                  is_multi_sub_event: event.event_structure === 'ENVELOPE' || !!event.event_end_date,
                  // The event has only ever stored a blank city for online.
                  where_mode: event.city ? 'in-person' : 'online',
                  time: invitationContent.time,
                  venue: invitationContent.location,
                  good_to_know: invitationContent.goodToKnow,
                }}
                onSubmit={handleSubmit}
                submitLabel={forwardLabel}
                multiSubmitLabel={done?.['sub-events'] ? forwardLabel : 'Save and add sub-events'}
                loading={loading}
                onCancel={() => router.back()}
                showStructureChoice
                inviteContent="edit"
                inviteContentLockedHref={
                  invitationLocked ? `/host/events/${eventId}/page-editor?panel=event-details` : undefined
                }
                // Only the owner manages co-hosts.
                coHosts={
                  event.my_role === 'owner'
                    ? { count: coHostCount, href: `/host/events/${eventId}#cohosts` }
                    : undefined
                }
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
                <strong className="text-orange-600">{rsvpWarningCount}</strong> guest{rsvpWarningCount === 1 ? '' : 's'} already said yes to the current date. They won&apos;t hear about the new one unless you tell them.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={async () => {
                    const data = pendingData
                    setPendingData(null)
                    setRsvpWarningCount(null)
                    if (data) await saveChanges(data, `/host/events/${eventId}/communications?tab=send`)
                  }}
                  className="min-h-[44px] bg-eco-green hover:bg-eco-green-dark text-white"
                >
                  Change date and message them
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    const data = pendingData
                    setPendingData(null)
                    setRsvpWarningCount(null)
                    if (data) await saveChanges(data)
                  }}
                  className="min-h-[44px] border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Change date only
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPendingData(null)
                    setRsvpWarningCount(null)
                  }}
                  className="min-h-[44px] text-gray-600"
                >
                  Keep the current date
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
