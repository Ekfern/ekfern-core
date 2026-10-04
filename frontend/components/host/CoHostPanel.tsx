'use client'

import { useCallback, useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logError } from '@/lib/error-handler'
import {
  inviteCoHost,
  listCoHosts,
  MAX_COHOSTS_PER_EVENT,
  removeCoHost,
  updateCoHost,
  type CoHost,
  type CoHostCapability,
  type CoHostNotification,
} from '@/lib/cohosts'
import { coHostChips, type CoHostChipModel } from '@/lib/cohostChips'
import CoHostChipRow from '@/components/host/CoHostChips'
import CoHostSettings from '@/components/host/CoHostSettings'

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
  const [openId, setOpenId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

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
  const atLimit = active.length >= MAX_COHOSTS_PER_EVENT
  const chips = coHostChips(coHosts)
  const openCoHost = coHosts.find((c) => c.id === openId && c.status === 'accepted') ?? null

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

  const removeChip = async (chip: CoHostChipModel) => {
    const target = coHosts.find((c) => c.id === chip.coHostId)
    if (!target) return
    if (chip.removal !== 'instant') {
      // Someone would lose something - an open invite or their access - so ask.
      setPendingRemoval(target)
      return
    }
    // Declined or left: nobody loses anything, it only clears the list.
    setBusy(true)
    try {
      await removeCoHost(eventId, target.id)
      await load()
    } catch (err: any) {
      logError('Clearing co-host failed', err)
      showToast(err?.response?.data?.error || getErrorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** Saves one switch. Shown flipped at once; flipped back if the save fails. */
  const saveSettings = async (
    target: CoHost,
    changes: { capabilities?: CoHostCapability[]; notifications?: CoHostNotification[] },
  ) => {
    setCoHosts((rows) => rows.map((c) => (c.id === target.id ? { ...c, ...changes } : c)))
    setSaving(true)
    try {
      const saved = await updateCoHost(eventId, target.id, changes)
      setCoHosts((rows) => rows.map((c) => (c.id === saved.id ? saved : c)))
    } catch (err: any) {
      logError('Co-host settings update failed', err)
      setCoHosts((rows) => rows.map((c) => (c.id === target.id ? target : c)))
      showToast(err?.response?.data?.error || 'Could not save that change. Try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleIn = <T,>(list: T[], item: T, on: boolean): T[] =>
    on ? Array.from(new Set([...list, item])) : list.filter((x) => x !== item)

  const confirmRemoval = async () => {
    if (!pendingRemoval) return
    setBusy(true)
    try {
      await removeCoHost(eventId, pendingRemoval.id)
      if (openId === pendingRemoval.id) setOpenId(null)
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
        ) : chips.length === 0 ? (
          <p className="text-sm text-gray-500">No co-hosts yet.</p>
        ) : (
          <div className="space-y-3">
            <CoHostChipRow
              chips={chips}
              disabled={busy}
              onRemove={removeChip}
              openKey={openCoHost ? `cohost:${openCoHost.id}` : null}
              onOpen={(chip) => setOpenId((id) => (id === chip.coHostId ? null : chip.coHostId ?? null))}
            />
            {openCoHost ? (
              <CoHostSettings
                coHost={openCoHost}
                saving={saving}
                onClose={() => setOpenId(null)}
                onCapabilityChange={(cap, on) =>
                  saveSettings(openCoHost, { capabilities: toggleIn(openCoHost.capabilities, cap, on) })
                }
                onNotificationChange={(n, on) =>
                  saveSettings(openCoHost, { notifications: toggleIn(openCoHost.notifications, n, on) })
                }
              />
            ) : null}
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
                  <strong>{pendingRemoval.name || pendingRemoval.email}</strong>
                  {pendingRemoval.name ? ` (${pendingRemoval.email})` : ''} will lose access to this
                  event immediately. Anything they already changed stays as it is.
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
