'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getMyCoHostInvites, type CoHostInvite } from '@/lib/cohosts'

/**
 * Pending co-host invites for the signed-in user.
 *
 * A pending invite is deliberately not an event card: nothing has been granted
 * until it is accepted, so it must not look like something they already have.
 */
export default function CoHostInviteBanner() {
  const [invites, setInvites] = useState<CoHostInvite[]>([])

  useEffect(() => {
    let cancelled = false
    getMyCoHostInvites().then((rows) => {
      if (!cancelled) setInvites(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (invites.length === 0) return null

  return (
    <div className="mb-6 space-y-2">
      {invites.map((invite) => (
        <div
          key={invite.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-eco-green-light bg-white px-4 py-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="shrink-0 rounded-full bg-eco-green-light p-2 text-eco-green">
              <Mail size={16} aria-hidden />
            </span>
            <p className="text-sm text-gray-800 min-w-0">
              <strong>{invite.invited_by}</strong> invited you to co-host{' '}
              <strong>{invite.event.title}</strong>
            </p>
          </div>
          <Link href={`/cohost-invite/${invite.token}`} className="shrink-0">
            <Button size="sm" className="bg-eco-green hover:bg-eco-green-dark text-white">
              View invite
            </Button>
          </Link>
        </div>
      ))}
    </div>
  )
}
