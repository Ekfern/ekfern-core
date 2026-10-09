'use client'

import React, { createContext, useContext } from 'react'
import { guestRibbon, type Lifecycle } from '@/lib/invite/lifecycle'

/**
 * Where the event is in its life, for the tiles that change with it - the RSVP
 * button, the countdown, the ribbon.
 *
 * Only the guest-facing invitation provides it. The editor preview and layout
 * thumbnails render without a provider and so always show the invitation as
 * designed, never "ended".
 */
const LifecycleContext = createContext<Lifecycle | null>(null)

export function LifecycleProvider({ lifecycle, children }: { lifecycle: Lifecycle | null; children: React.ReactNode }) {
  return <LifecycleContext.Provider value={lifecycle}>{children}</LifecycleContext.Provider>
}

export function useLifecycle(): Lifecycle | null {
  return useContext(LifecycleContext)
}

/**
 * "This celebration has ended", set on the paper in the invitation's own ink
 * and type, between two hairlines - a line of the stationery, not an alert
 * pasted over it. Says nothing while the event is still to come.
 */
export function LifecycleRibbon() {
  const ribbon = guestRibbon(useLifecycle())
  if (!ribbon) return null
  return (
    <div role="status" className="w-full px-6">
      <div
        className="mx-auto max-w-md py-3 text-center"
        style={{
          borderTop: '1px solid color-mix(in srgb, var(--theme-fg) 22%, transparent)',
          borderBottom: '1px solid color-mix(in srgb, var(--theme-fg) 22%, transparent)',
          color: 'var(--theme-fg)',
        }}
      >
        <p className="text-base tracking-wide" style={{ fontFamily: 'var(--theme-font-title)' }}>
          {ribbon.text}
        </p>
        {ribbon.note && (
          <p className="mt-1 text-sm whitespace-pre-line" style={{ color: 'var(--theme-muted)' }}>
            {ribbon.note}
          </p>
        )}
      </div>
    </div>
  )
}
