'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logError } from '@/lib/error-handler'
import {
  acceptCoHostInvite,
  CAPABILITY_LABELS,
  declineCoHostInvite,
  getCoHostInvite,
  type CoHostInviteDetail,
} from '@/lib/cohosts'

interface Me {
  id: number
  email: string
  name?: string
}

export default function CoHostInvitePage() {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()
  const token = (params.token as string) || ''

  const [invite, setInvite] = useState<CoHostInviteDetail | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setInvite(await getCoHostInvite(token))
    } catch (e: any) {
      logError('Co-host invite lookup failed', e)
      setError(e?.response?.data?.error || 'This invite link is invalid or has expired.')
    }
    // Who is signed in, if anyone. The invite itself is readable without an account.
    try {
      // Nobody signed in is a normal answer here, not an expired session: the
      // page shows the invite and its own "Sign in to continue".
      const res = await api.get<Me>('/api/auth/me/', { skipAuthRedirect: true })
      setMe(res.data)
    } catch {
      setMe(null)
    }
    setLoading(false)
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const accept = async () => {
    setBusy(true)
    try {
      await acceptCoHostInvite(token)
      showToast('You are now a co-host.', 'success')
      router.push('/host/dashboard')
    } catch (e: any) {
      logError('Co-host accept failed', e)
      showToast(e?.response?.data?.error || getErrorMessage(e), 'error')
      setBusy(false)
    }
  }

  const decline = async () => {
    setBusy(true)
    try {
      await declineCoHostInvite(token)
      showToast('Invite declined.', 'info')
      await load()
    } catch (e: any) {
      logError('Co-host decline failed', e)
      showToast(e?.response?.data?.error || getErrorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </div>
    )
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white">
          <CardHeader>
            <CardTitle className="text-eco-green">Invite unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-700">{error || 'This invite link is invalid or has expired.'}</p>
            <p className="text-sm text-gray-600">Ask the host to send you a new one.</p>
            <Link href="/host/dashboard">
              <Button variant="outline" className="w-full">Go to dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const signedInEmail = (me?.email || '').trim().toLowerCase()
  const emailMatches = !!me && signedInEmail === invite.invited_email
  const alreadyResolved = invite.status !== 'pending'

  return (
    <div className="min-h-screen bg-eco-beige flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-white">
        <CardHeader>
          <CardTitle className="text-eco-green">
            {invite.invited_by} invited you to co-host
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-2xl font-semibold text-gray-900">{invite.event.title}</p>
            <p className="text-sm text-gray-600 mt-1">Invited as {invite.invited_email}</p>
          </div>

          {invite.capabilities.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-gray-800 mb-1">As a co-host you will be able to:</p>
              <ul className="text-sm text-gray-700 space-y-1">
                {invite.capabilities.map((c) => (
                  <li key={c} className="flex items-center gap-2">
                    <Check size={14} className="text-eco-green shrink-0" aria-hidden />
                    {CAPABILITY_LABELS[c] ?? c}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mt-2">
                Only the host can delete the event, invite other co-hosts, or change who hosts it.
              </p>
            </div>
          ) : null}

          {alreadyResolved ? (
            <p className="text-sm text-gray-700">
              This invite is no longer open ({invite.status}). Ask the host to send a new one.
            </p>
          ) : !me ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                {invite.account_exists
                  ? 'Sign in to accept this invite.'
                  : 'Create an account with this email address to accept.'}
              </p>
              <Link
                href={`${invite.account_exists ? '/host/login' : '/host/signup'}?email=${encodeURIComponent(invite.invited_email)}&next=${encodeURIComponent(`/cohost-invite/${token}`)}`}
              >
                <Button className="w-full bg-eco-green hover:bg-eco-green-dark text-white">
                  {invite.account_exists ? 'Sign in to continue' : 'Create an account'}
                </Button>
              </Link>
            </div>
          ) : !emailMatches ? (
            <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
              <p className="text-sm text-gray-800">
                This invite was sent to <strong>{invite.invited_email}</strong>, but you are signed
                in as <strong>{me.email}</strong>.
              </p>
              <p className="text-sm text-gray-700">
                Sign in with the invited address, or ask the host to invite this one instead.
              </p>
              <Link href={`/host/login?email=${encodeURIComponent(invite.invited_email)}&next=${encodeURIComponent(`/cohost-invite/${token}`)}`}>
                <Button variant="outline" className="w-full">Sign in as {invite.invited_email}</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={policyAccepted}
                  onChange={(e) => setPolicyAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-eco-green"
                />
                <span>
                  I agree to the{' '}
                  <Link href="/privacy" className="text-eco-green underline" target="_blank">
                    Privacy Policy
                  </Link>{' '}
                  and understand I will be able to see this event&apos;s guest details.
                </span>
              </label>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={decline}
                  disabled={busy}
                  className="flex-1 gap-1 text-gray-700"
                >
                  <X size={14} />
                  Decline
                </Button>
                <Button
                  onClick={accept}
                  disabled={busy || !policyAccepted}
                  className="flex-1 bg-eco-green hover:bg-eco-green-dark text-white"
                >
                  {busy ? 'Working…' : 'Accept invite'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
