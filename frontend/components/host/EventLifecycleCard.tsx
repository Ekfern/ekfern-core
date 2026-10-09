'use client'

import { useState } from 'react'
import { Link } from 'next-view-transitions'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { getErrorMessage } from '@/lib/error-handler'
import { hostBadge, lastDayLabel, type Lifecycle } from '@/lib/invite/lifecycle'

/** What the host-side serializer adds to the guest lifecycle. */
export interface HostLifecycle extends Lifecycle {
  cancelled_at: string | null
  cancel_note: string
  link_off_enforced: boolean
  can_reopen_catalog: boolean
}

interface Props {
  eventId: number
  lifecycle: HostLifecycle
  hasGifts: boolean
  isOwner: boolean
  canEditGifts: boolean
  onChange: (lifecycle: HostLifecycle) => void
}

/**
 * When each part of the event closes, shown from the day it is created - so a
 * host is never surprised by a link going quiet - and the host's hand on it:
 * close or reopen gifts, cancel or restore the event.
 */
export default function EventLifecycleCard({ eventId, lifecycle, hasGifts, isOwner, canEditGifts, onChange }: Props) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [note, setNote] = useState(lifecycle.cancel_note || '')
  const [justCancelled, setJustCancelled] = useState(false)

  const zone = lifecycle.timezone
  const cancelled = lifecycle.phase === 'cancelled'

  const act = async (path: string, body: Record<string, unknown> = {}, done?: string) => {
    setBusy(true)
    try {
      const res = await api.post(`/api/events/${eventId}/${path}/`, body)
      onChange(res.data.lifecycle)
      if (done) showToast(done, 'success')
      return true
    } catch (error) {
      showToast(getErrorMessage(error, 'That did not work. Please try again.'), 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const rows: Array<[string, string]> = []
  if (lifecycle.series && !lifecycle.ends_at) {
    rows.push(['Repeats', 'No end date yet'])
  } else {
    rows.push(['Last day', lifecycle.ends_at ? lastDayLabel(lifecycle.ends_at, zone) : 'Add a date'])
  }
  rows.push(['RSVPs', lifecycle.rsvp_open ? (lifecycle.ends_at ? `Open until ${lastDayLabel(lifecycle.ends_at, zone)}` : 'Open') : 'Closed'])
  if (hasGifts) {
    rows.push([
      'Gifts',
      lifecycle.catalog_open
        ? lifecycle.catalog_closes_at ? `Open until ${lastDayLabel(lifecycle.catalog_closes_at, zone)}` : 'Open'
        : lifecycle.catalog_closed_early ? 'Closed by you' : 'Closed',
    ])
  }
  rows.push([
    'Invite link',
    lifecycle.phase === 'archived'
      ? 'No longer available to guests'
      : lifecycle.link_off_enforced && lifecycle.link_off_at
        ? `Works until ${lastDayLabel(lifecycle.link_off_at, zone)} - we will email you a week before`
        : 'Stays available',
  ])

  return (
    <Card className="bg-white border-2 border-eco-green-light">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-eco-green">After the event</CardTitle>
          <span className="text-xs font-medium rounded-full bg-gray-100 px-3 py-1 text-gray-700">{hostBadge(lifecycle)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-gray-500">{label}</dt>
              <dd className="text-right font-medium text-gray-800">{value}</dd>
            </div>
          ))}
        </dl>

        {cancelled && lifecycle.cancel_note && (
          <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-line">
            Guests see: “{lifecycle.cancel_note}”
          </p>
        )}

        {justCancelled && (
          <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            Let your guests know.{' '}
            <Link href={`/host/events/${eventId}/communications`} className="font-medium underline underline-offset-2">
              Send a message
            </Link>{' '}
            to everyone who said yes.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {hasGifts && canEditGifts && !cancelled && lifecycle.phase !== 'archived' && (
            lifecycle.catalog_open ? (
              <Button
                variant="outline"
                disabled={busy}
                className="min-h-[44px]"
                onClick={() => {
                  if (window.confirm('Close gifts now? Guests will see “Gifting has closed”. You can reopen them until the usual closing date.')) {
                    act('close-catalog', {}, 'Gifts closed')
                  }
                }}
              >
                Close gifts now
              </Button>
            ) : lifecycle.can_reopen_catalog ? (
              <Button variant="outline" disabled={busy} className="min-h-[44px]" onClick={() => act('reopen-catalog', {}, 'Gifts reopened')}>
                Reopen gifts
              </Button>
            ) : null
          )}

          {isOwner && (cancelled || !['ended', 'archived'].includes(lifecycle.phase)) && (
            cancelled ? (
              <Button variant="outline" disabled={busy} className="min-h-[44px]" onClick={async () => { if (await act('uncancel', {}, 'Event restored')) setJustCancelled(false) }}>
                Restore event
              </Button>
            ) : !cancelling ? (
              <Button variant="outline" disabled={busy} className="min-h-[44px] text-red-700 border-red-200 hover:bg-red-50" onClick={() => setCancelling(true)}>
                Cancel event
              </Button>
            ) : null
          )}
        </div>

        {cancelling && !cancelled && (
          <div className="space-y-3 rounded-lg border border-red-200 p-4">
            <label htmlFor="cancel-note" className="block text-sm font-medium text-gray-800">
              A note for your guests (optional)
            </label>
            <textarea
              id="cancel-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="We’re so sorry - we’ll share a new date soon."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500">
              RSVPs and gifts close straight away and your invitation says the event is cancelled. You can restore it later.
            </p>
            <div className="flex gap-2">
              <Button
                disabled={busy}
                className="min-h-[44px] bg-red-700 hover:bg-red-800 text-white"
                onClick={async () => {
                  if (await act('cancel', { note }, 'Event cancelled')) {
                    setCancelling(false)
                    setJustCancelled(true)
                  }
                }}
              >
                Cancel the event
              </Button>
              <Button variant="outline" disabled={busy} className="min-h-[44px]" onClick={() => setCancelling(false)}>
                Keep it
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
