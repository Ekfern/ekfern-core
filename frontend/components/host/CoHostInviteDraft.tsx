'use client'

import { useEffect, useState } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MAX_COHOSTS_PER_EVENT } from '@/lib/cohosts'

/** Same shape the API canonicalises to, so what is collected is what is sent. */
function canonical(raw: string): string {
  return raw.trim().toLowerCase()
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export interface CoHostInviteDraftProps {
  value: string[]
  onChange: (emails: string[]) => void
}

/**
 * Collects co-host invites while an event is being created.
 *
 * Nothing is sent from here — an invite needs an event id, and the event does
 * not exist yet. The create page fires these once it has one, so to the host it
 * reads as part of creating the event while technically every invite still
 * targets a saved event.
 */
export default function CoHostInviteDraft({ value, onChange }: CoHostInviteDraftProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [myEmail, setMyEmail] = useState('')

  // Needed only so inviting yourself can be dropped quietly rather than failing
  // after the event has already been created.
  useEffect(() => {
    let cancelled = false
    api
      .get('/api/auth/me/')
      .then((res) => {
        if (!cancelled) setMyEmail(canonical(res.data?.email || ''))
      })
      .catch(() => {
        /* Not fatal: the server rejects self-invites anyway. */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const atLimit = value.length >= MAX_COHOSTS_PER_EVENT

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const next = canonical(email)
    if (!next) return
    if (!looksLikeEmail(next)) {
      setError('Enter a valid email address.')
      return
    }
    setError('')
    setEmail('')
    // Your own address and one already listed are both dropped in silence:
    // the intent is obvious and there is nothing for the host to fix.
    if (next === myEmail || value.includes(next)) return
    if (atLimit) return
    onChange([...value, next])
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
      <CardContent className="space-y-4">
        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError('')
            }}
            placeholder="their@email.com"
            aria-label="Co-host email address"
            className="flex-1"
            disabled={atLimit}
          />
          <Button
            type="submit"
            disabled={atLimit || !email.trim()}
            className="gap-2 bg-eco-green hover:bg-eco-green-dark text-white"
          >
            <UserPlus size={16} />
            Add
          </Button>
        </form>

        {error ? <p className="text-sm text-red-600 -mt-2">{error}</p> : null}

        <p className="text-xs text-gray-500">
          {atLimit
            ? `That's the maximum of ${MAX_COHOSTS_PER_EVENT} co-hosts.`
            : 'Invites are sent once your event is created. They must accept before they can see anything.'}
        </p>

        {value.length > 0 ? (
          <ul className="space-y-2">
            {value.map((addr) => (
              <li
                key={addr}
                className="flex items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{addr}</p>
                  <p className="text-xs text-gray-600">Will be invited when you create the event</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Remove ${addr}`}
                  onClick={() => onChange(value.filter((v) => v !== addr))}
                  className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 size={14} />
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}
