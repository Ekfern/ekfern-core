/**
 * Unit tests for co-host chips — what each invite looks like and what ✕ does.
 */

import { describe, expect, it } from 'vitest'
import { coHostChip, coHostChips, draftChip, formatChipDate } from './cohostChips'
import type { CoHost } from './cohosts'

const now = new Date('2026-09-30T12:00:00Z')

function row(overrides: Partial<CoHost>): CoHost {
  return {
    id: 1,
    email: 'priya@example.com',
    name: null,
    status: 'pending',
    capabilities: [],
    notifications: [],
    accepted_at: null,
    declined_at: null,
    left_at: null,
    created_at: '2026-09-29T12:00:00Z',
    ...overrides,
  }
}

describe('coHostChip', () => {
  it('shows a pending invite outlined, by email, and asks before cancelling', () => {
    expect(coHostChip(row({ status: 'pending' }), now)).toMatchObject({
      tone: 'pending',
      label: 'priya@example.com',
      detail: 'Invited Sep 29',
      removal: 'confirm-cancel',
      opensSettings: false,
    })
  })

  it('shows an accepted co-host green, by name, opening their settings', () => {
    expect(
      coHostChip(row({ status: 'accepted', name: 'Priya Shah', accepted_at: '2026-09-30T09:00:00Z' }), now),
    ).toMatchObject({
      tone: 'accepted',
      label: 'Priya Shah',
      email: 'priya@example.com',
      detail: 'Co-host since Sep 30',
      removal: 'confirm-revoke',
      opensSettings: true,
    })
  })

  it('falls back to the email when an accepted account has no name', () => {
    expect(coHostChip(row({ status: 'accepted' }), now)?.label).toBe('priya@example.com')
  })

  it('clears a declined invite without asking', () => {
    expect(coHostChip(row({ status: 'declined', declined_at: '2026-09-30T09:00:00Z' }), now)).toMatchObject({
      tone: 'declined',
      detail: 'Declined Sep 30',
      removal: 'instant',
    })
  })

  it('greys out someone who left and says when', () => {
    expect(coHostChip(row({ status: 'left', left_at: '2026-09-30T09:00:00Z' }), now)).toMatchObject({
      tone: 'left',
      detail: 'Left Sep 30',
      removal: 'instant',
    })
  })

  it('hides an invite the owner removed', () => {
    expect(coHostChip(row({ status: 'revoked' }), now)).toBeNull()
  })

  it('still reads sensibly without a date', () => {
    expect(coHostChip(row({ status: 'left', left_at: null }), now)?.detail).toBe('Left')
  })
})

describe('draftChip', () => {
  it('is outlined, not yet sent, and removed without asking', () => {
    expect(draftChip('new@example.com')).toMatchObject({
      tone: 'draft',
      label: 'new@example.com',
      detail: 'Will be invited when you create the event',
      removal: 'instant',
      opensSettings: false,
    })
  })
})

describe('coHostChips', () => {
  it('keeps the order invites were sent and drops removed ones', () => {
    const chips = coHostChips(
      [
        row({ id: 3, email: 'c@x.com', created_at: '2026-09-29T15:00:00Z' }),
        row({ id: 1, email: 'a@x.com', created_at: '2026-09-29T10:00:00Z', status: 'accepted' }),
        row({ id: 2, email: 'b@x.com', created_at: '2026-09-29T12:00:00Z', status: 'revoked' }),
      ],
      now,
    )
    expect(chips.map((c) => c.email)).toEqual(['a@x.com', 'c@x.com'])
  })
})

describe('formatChipDate', () => {
  it('omits this year and keeps any other', () => {
    expect(formatChipDate('2026-03-05T12:00:00Z', now)).toBe('Mar 5')
    expect(formatChipDate('2025-03-05T12:00:00Z', now)).toBe('Mar 5, 2025')
  })

  it('is empty for a missing or unreadable date', () => {
    expect(formatChipDate(null, now)).toBe('')
    expect(formatChipDate('soon', now)).toBe('')
  })
})
