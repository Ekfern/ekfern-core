/**
 * How each co-host invite appears as a chip, in one place for both the create
 * page (addresses not sent yet) and Edit Event Details (sent invites), so the
 * two cannot drift apart.
 *
 * Colour carries the status: green accepted, red declined, grey left. Pending
 * and not-yet-sent chips are outlined only, and pending also carries ⏳ so it
 * is not mistaken for a draft. Invites the owner removed are not shown.
 */

import type { CoHost } from './cohosts'

export type ChipTone = 'draft' | 'pending' | 'accepted' | 'declined' | 'left'

/**
 * What ✕ does. `instant` needs no confirmation because nobody loses anything:
 * the invite was never sent, or it already ended.
 */
export type ChipRemoval = 'instant' | 'confirm-cancel' | 'confirm-revoke'

export interface CoHostChipModel {
  key: string
  /** Shown on the chip: the account name when known, otherwise the email. */
  label: string
  email: string
  tone: ChipTone
  /** Status in words, for the hover text and the tap-to-read caption. */
  detail: string
  removal: ChipRemoval
  /** Tapping opens the permission and notification switches. */
  opensSettings: boolean
  /** The sent invite behind this chip; absent for a draft. */
  coHostId?: number
}

/** "Sep 29", or "Sep 29, 2025" when it was not this year. */
export function formatChipDate(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}

function since(prefix: string, iso: string | null | undefined, now: Date): string {
  const when = formatChipDate(iso, now)
  return when ? `${prefix} ${when}` : prefix
}

export function draftChip(email: string): CoHostChipModel {
  return {
    key: `draft:${email}`,
    label: email,
    email,
    tone: 'draft',
    detail: 'Will be invited when you create the event',
    removal: 'instant',
    opensSettings: false,
  }
}

/** The chip for a sent invite, or null when it should not be shown. */
export function coHostChip(c: CoHost, now: Date = new Date()): CoHostChipModel | null {
  const base = { key: `cohost:${c.id}`, email: c.email, coHostId: c.id, label: c.name || c.email }
  switch (c.status) {
    case 'pending':
      return {
        ...base,
        // No account yet, so never a name.
        label: c.email,
        tone: 'pending',
        detail: since('Invited', c.created_at, now),
        removal: 'confirm-cancel',
        opensSettings: false,
      }
    case 'accepted':
      return {
        ...base,
        tone: 'accepted',
        detail: since('Co-host since', c.accepted_at, now),
        removal: 'confirm-revoke',
        opensSettings: true,
      }
    case 'declined':
      return {
        ...base,
        tone: 'declined',
        detail: since('Declined', c.declined_at, now),
        removal: 'instant',
        opensSettings: false,
      }
    case 'left':
      return {
        ...base,
        tone: 'left',
        detail: since('Left', c.left_at, now),
        removal: 'instant',
        opensSettings: false,
      }
    default:
      // Removed by the owner: gone from the list.
      return null
  }
}

/** Chips in the order the invites were sent, so a chip changes colour in place. */
export function coHostChips(coHosts: CoHost[], now: Date = new Date()): CoHostChipModel[] {
  return [...coHosts]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
    .map((c) => coHostChip(c, now))
    .filter((chip): chip is CoHostChipModel => chip !== null)
}
