/**
 * Which way a host navigation moves, for the page transition.
 *
 * Phones settled this long ago: going deeper slides the new screen in from
 * the right, coming back slides it out, and switching tabs does not slide at
 * all - the tabs are side by side, not one inside another. So:
 *
 *   Dashboard -> an event                 forward
 *   Overview -> Edit Event Details        forward
 *   Edit Event Details -> Overview        back
 *   Overview <-> Guests <-> RSVP          tab (a quick fade)
 */

export type NavDirection = 'forward' | 'back' | 'tab'

/** The tabs of one event - side by side, so moving between them is a fade. */
const EVENT_TABS = new Set(['', 'page-editor', 'guests', 'rsvp', 'sub-events', 'communications', 'catalog'])

/** How deep a host page sits: dashboard 0, an event's tabs 1, steps inside an event 2. */
function depth(path: string): { level: number; eventId?: string; tab?: string } {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '')
  const event = /^\/host\/events\/(\d+)(?:\/([^/]+))?/.exec(clean)
  if (event) {
    const section = event[2] ?? ''
    return EVENT_TABS.has(section) ? { level: 1, eventId: event[1], tab: section } : { level: 2, eventId: event[1] }
  }
  if (clean === '/host/dashboard' || clean === '/host') return { level: 0 }
  // Profile, Create event, the studios: one step in from the dashboard.
  return { level: 1 }
}

export function navDirection(from: string | null | undefined, to: string): NavDirection {
  if (!from) return 'tab'
  const a = depth(from)
  const b = depth(to)
  if (b.level > a.level) return 'forward'
  if (b.level < a.level) return 'back'
  return 'tab'
}
