import api from '@/lib/api'

/** Capability names the API recognises. Writes only — read access is implicit. */
export type CoHostCapability =
  | 'send_messages'
  | 'manage_guests'
  | 'edit_invitation'
  | 'edit_rsvp'
  | 'edit_catalog'

/**
 * Host emails a co-host can also receive. Not a permission - it grants nothing,
 * it only adds them to the mailing. How often is each person's own setting.
 */
export type CoHostNotification = 'rsvp_new' | 'catalog_response'

export type CoHostStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'left'

/** 'owner' | 'cohost' | null — null means no access to this event. */
export type EventRole = 'owner' | 'cohost' | null

export interface CoHost {
  id: number
  email: string
  /** Null while pending: there is no account yet, so there is no name to show. */
  name: string | null
  status: CoHostStatus
  capabilities: CoHostCapability[]
  notifications: CoHostNotification[]
  accepted_at: string | null
  declined_at: string | null
  left_at: string | null
  created_at: string
}

export interface CoHostInvite {
  id: number
  token: string
  event: { id: number; title: string }
  invited_by: string
  capabilities: CoHostCapability[]
}

export interface CoHostInviteDetail {
  status: CoHostStatus
  invited_email: string
  event: { id: number; title: string }
  invited_by: string
  capabilities: CoHostCapability[]
  account_exists: boolean
}

/**
 * How many people may hold access to one event at a time. Mirrors
 * MAX_COHOSTS_PER_EVENT in apps/events/capabilities.py — the server is the real
 * limit; this only keeps the UI from offering what will be refused.
 */
export const MAX_COHOSTS_PER_EVENT = 5

export const CAPABILITY_LABELS: Record<CoHostCapability, string> = {
  manage_guests: 'Manage guests',
  send_messages: 'Send messages',
  edit_invitation: 'Edit invitation',
  edit_rsvp: 'Edit RSVP',
  edit_catalog: 'Edit catalog',
}

export const NOTIFICATION_LABELS: Record<CoHostNotification, string> = {
  rsvp_new: 'New RSVPs',
  catalog_response: 'Catalog responses',
}

export async function listCoHosts(eventId: number | string): Promise<CoHost[]> {
  const res = await api.get(`/api/events/${eventId}/cohosts/`)
  return res.data?.results ?? []
}

export async function inviteCoHost(
  eventId: number | string,
  email: string,
  capabilities?: CoHostCapability[],
): Promise<CoHost> {
  const payload: Record<string, unknown> = { email }
  if (capabilities) payload.capabilities = capabilities
  const res = await api.post(`/api/events/${eventId}/cohosts/`, payload)
  return res.data
}

/** Change what a co-host may do and which emails they get. Owner only. */
export async function updateCoHost(
  eventId: number | string,
  coHostId: number,
  changes: { capabilities?: CoHostCapability[]; notifications?: CoHostNotification[] },
): Promise<CoHost> {
  const res = await api.patch(`/api/events/${eventId}/cohosts/${coHostId}/`, changes)
  return res.data
}

/**
 * Revoke an accepted co-host, cancel a pending invite, or clear a declined or
 * left one from the list. Owner only.
 */
export async function removeCoHost(eventId: number | string, coHostId: number): Promise<CoHost> {
  const res = await api.delete(`/api/events/${eventId}/cohosts/${coHostId}/`)
  return res.data
}

/** A co-host removes themselves from an event they were sharing. */
export async function leaveEvent(eventId: number | string): Promise<void> {
  await api.post(`/api/events/${eventId}/cohosts/leave/`)
}

/** Pending invites for the signed-in user, for the dashboard banner. */
export async function getMyCoHostInvites(): Promise<CoHostInvite[]> {
  try {
    const res = await api.get('/api/events/cohost-invites/mine/')
    return res.data?.results ?? []
  } catch {
    // The banner is an extra; never let it break the dashboard.
    return []
  }
}

/** Readable without an account, so someone can see what they are joining. */
export async function getCoHostInvite(token: string): Promise<CoHostInviteDetail> {
  const res = await api.get(`/api/events/cohost-invites/${token}/`)
  return res.data
}

export async function acceptCoHostInvite(token: string): Promise<CoHost> {
  const res = await api.post(`/api/events/cohost-invites/${token}/accept/`, {
    policy_accepted: true,
  })
  return res.data
}

export async function declineCoHostInvite(token: string): Promise<void> {
  await api.post(`/api/events/cohost-invites/${token}/decline/`)
}
