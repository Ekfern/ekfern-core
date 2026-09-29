'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logError } from '@/lib/error-handler'
import {
  CAPABILITY_LABELS,
  inviteCoHost,
  listCoHosts,
  MAX_COHOSTS_PER_EVENT,
  removeCoHost,
  type CoHost,
} from '@/lib/cohosts'

/** Statuses worth showing the host. A finished invite stays visible as history. */
const STATUS_LABELS: Record<CoHost['status'], string> = {
  pending: 'Invited — waiting for them to accept',
  accepted: 'Co-host',
  declined: 'Declined the invite',
  revoked: 'Removed',
  left: 'Left the event',
}

export interface CoHostPanelProps {
  eventId: number | string
  /** Rendered only for the owner; co-hosts cannot manage the team. */
  canManage: boolean
}

export default function CoHostPanel({ eventId, canManage }: CoHostPanelProps) {
  const { showToast } = useToast()
  const [coHosts, setCoHosts] = useState<CoHost[]>([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<CoHost | null>(null)

  const load = useCallback(async () => {
    try {
      setCoHosts(await listCoHosts(eventId))
    } catch (e) {
      logError('Failed to load co-hosts', e)
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    if (canManage) load()
    else setLoading(false)
  }, [canManage, load])

  if (!canManage) return null

  // Only active invites occupy a slot, matching how the server counts them.
  const active = coHosts.filter((c) => c.status === 'pending' || c.status === 'accepted')
  const past = coHosts.filter((c) => c.status !== 'pending' && c.status !== 'accepted')
  const atLimit = active.length >= MAX_COHOSTS_PER_EVENT

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!value) return
    setBusy(true)
    try {
      await inviteCoHost(eventId, value)
      setEmail('')
      await load()
      showToast(`Invite sent to ${value.toLowerCase()}.`, 'success')
    } catch (err: any) {
      logError('Co-host invite failed', err)
      showToast(err?.response?.data?.error || getErrorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const confirmRemoval = async () => {
    if (!pendingRemoval) return
    setBusy(true)
    try {
      await removeCoHost(eventId, pendingRemoval.id)
      await load()
      showToast(
        pendingRemoval.status === 'pending' ? 'Invite cancelled.' : 'Co-host removed.',
        'success',
      )
    } catch (err: any) {
      logError('Co-host removal failed', err)
      showToast(err?.response?.data?.error || getErrorMessage(err), 'error')
    } finally {
      setBusy(false)
      setPendingRemoval(null)
    }
  }

  return (
    <Card className="bg-white border-2 border-eco-green-light mt-6">
      <CardHeader>
        <CardTitle className="text-eco-green">Invite a Co-host (Optional)</CardTitle>
        <CardDescription>
          Co-hosts help you run this event. They can see and manage it, but only you can
          delete the event, invite other co-hosts, or change who hosts it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="their@email.com"
            aria-label="Co-host email address"
            className="flex-1"
            disabled={busy || atLimit}
          />
          <Button type="submit" disabled={busy || atLimit || !email.trim()} className="gap-2 bg-eco-green hover:bg-eco-green-dark text-white">
            <UserPlus size={16} />
            {busy ? 'Sending…' : 'Send invite'}
          </Button>
        </form>
        <p className="text-xs text-gray-500 -mt-4">
          {atLimit
            ? `That's the maximum of ${MAX_COHOSTS_PER_EVENT} co-hosts. Remove someone, or cancel a pending invite, to add another.`
            : 'They will get an email and must accept before they can see anything.'}
        </p>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : active.length === 0 && past.length === 0 ? (
          <p className="text-sm text-gray-500">No co-hosts yet.</p>
        ) : (
          <div className="space-y-2">
            {[...active, ...past].map((c) => {
              const isPast = c.status !== 'pending' && c.status !== 'accepted'
              return (
                <div
                  key={c.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${
                    isPast ? 'opacity-60' : ''
                  }`}
                >
                  <div className="min-w-0">
                    {/* A pending row has no name because it has no account yet. */}
                    <p className="font-medium text-sm truncate">{c.name || c.email}</p>
                    {c.name ? <p className="text-xs text-gray-500 truncate">{c.email}</p> : null}
                    <p className="text-xs text-gray-600 mt-0.5">{STATUS_LABELS[c.status]}</p>
                    {c.status === 'accepted' && c.capabilities.length > 0 ? (
                      <p className="text-xs text-gray-500 mt-1">
                        {c.capabilities.map((cap) => CAPABILITY_LABELS[cap] ?? cap).join(' · ')}
                      </p>
                    ) : null}
                  </div>
                  {!isPast ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => setPendingRemoval(c)}
                      className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                      {c.status === 'pending' ? 'Cancel' : 'Remove'}
                    </Button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {pendingRemoval ? (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={busy ? undefined : () => setPendingRemoval(null)}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900">
              {pendingRemoval.status === 'pending' ? 'Cancel this invite?' : 'Remove this co-host?'}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {pendingRemoval.status === 'pending' ? (
                <>
                  <strong>{pendingRemoval.email}</strong> will no longer be able to accept.
                </>
              ) : (
                <>
                  <strong>{pendingRemoval.name || pendingRemoval.email}</strong> will lose access to
                  this event immediately. Anything they already changed stays as it is.
                </>
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPendingRemoval(null)} disabled={busy}>
                Keep
              </Button>
              <Button onClick={confirmRemoval} disabled={busy} className="bg-red-600 hover:bg-red-700 text-white">
                {busy ? 'Working…' : pendingRemoval.status === 'pending' ? 'Cancel invite' : 'Remove'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  )
}
