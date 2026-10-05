/**
 * Which creation steps an event has already done, read from the event itself.
 *
 * The steps are a first-run wizard only the first time. Afterwards they are
 * places to go back to, so the stepper shows each one done from the event's
 * data, and "Next" skips any that are done - walking back through Layout used
 * to mean re-applying it, which resets the colours and fonts set in the editor.
 */

import { invitationIsLaidOut } from '@/lib/invite/eventDetailsContent'
import type { InviteConfig } from '@/lib/invite/schema'

export type WizardStepKey = 'details' | 'sub-events' | 'layout' | 'page-editor'

/** The slice of the event API this needs. */
export interface WizardEvent {
  id: number
  event_structure?: 'SIMPLE' | 'ENVELOPE'
  page_config?: InviteConfig | null
  invite_page_summary?: { is_published?: boolean; config?: InviteConfig | null } | null
}

/** The invitation, from whichever store holds its tiles (older events may only have the draft). */
export function invitationOf(event: WizardEvent | null | undefined): InviteConfig | null {
  if (event?.page_config?.tiles?.length) return event.page_config
  return event?.invite_page_summary?.config ?? event?.page_config ?? null
}

export function completedSteps(event: WizardEvent | null | undefined): Record<WizardStepKey, boolean> {
  return {
    details: !!event,
    // An event becomes ENVELOPE once it has a sub-event.
    'sub-events': event?.event_structure === 'ENVELOPE',
    layout: invitationIsLaidOut(invitationOf(event)),
    // Done means published, not merely visited.
    'page-editor': !!event?.invite_page_summary?.is_published,
  }
}

/**
 * Where to go after saving Event Details or the Sub-events step: the first step
 * still to do, else straight back to the editor.
 */
export function nextStepAfter(
  from: 'details' | 'sub-events',
  event: WizardEvent,
  wantsSubEvents: boolean,
): string {
  const done = completedSteps(event)
  if (from === 'details' && wantsSubEvents && !done['sub-events']) return `/host/events/${event.id}/sub-events-setup`
  if (!done.layout) return `/host/events/${event.id}/layout`
  return `/host/events/${event.id}/page-editor`
}
