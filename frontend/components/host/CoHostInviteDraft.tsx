'use client'

import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MAX_COHOSTS_PER_EVENT } from '@/lib/cohosts'
import { draftChip } from '@/lib/cohostChips'
import CoHostChipRow from '@/components/host/CoHostChips'

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

  const add = () => {
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
    // A section of the create form, placed before its Next button so a host
    // passes it on the way out. It sits inside that <form>, so it has no form of
    // its own: Enter adds the address instead of creating the event.
    <section aria-labelledby="cohost-draft-heading" className="space-y-3 border-t border-gray-200 pt-5">
      <div>
        <h3 id="cohost-draft-heading" className="text-base font-semibold text-eco-green">
          Invite a Co-host (Optional)
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Co-hosts help you run this event. They can see and manage it, but only you can
          delete the event, invite other co-hosts, or change who hosts it.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (error) setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="their@email.com"
          aria-label="Co-host email address"
          className="flex-1"
          disabled={atLimit}
        />
        <Button
          type="button"
          onClick={add}
          disabled={atLimit || !email.trim()}
          className="gap-2 bg-eco-green hover:bg-eco-green-dark text-white"
        >
          <UserPlus size={16} />
          Add
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600 -mt-2">{error}</p> : null}

      <p className="text-xs text-gray-500">
        {atLimit
          ? `That's the maximum of ${MAX_COHOSTS_PER_EVENT} co-hosts.`
          : 'Invites are sent once your event is created. They must accept before they can see anything.'}
      </p>

      <CoHostChipRow
        chips={value.map(draftChip)}
        onRemove={(chip) => onChange(value.filter((v) => v !== chip.email))}
      />
    </section>
  )
}
