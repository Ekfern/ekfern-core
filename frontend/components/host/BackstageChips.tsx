'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Globe, Lock, UserPlus, X } from 'lucide-react'

export interface BackstageValue {
  is_public: boolean
  has_rsvp: boolean
  has_registry: boolean
}

interface BackstageChipsProps {
  value: BackstageValue
  onChange: (patch: Partial<BackstageValue>) => void
  /**
   * Co-hosts. While creating, `panel` opens the invite section here. Once the
   * event exists they are managed on its Overview, and `href` links there.
   */
  coHosts?: { count: number; panel?: React.ReactNode; href?: string }
}

type Panel = 'who' | 'cohosts' | null

/**
 * Backstage: how the event behaves, which guests never see.
 *
 * The same four settings the form always had - who can see it, RSVP, the host
 * catalog, co-hosts - as chips that show their state, so the host reads the
 * event's set-up at a glance and opens only the one they want to change. Panels
 * open inline, below the chips, so nothing floats over the form on a phone.
 */
export default function BackstageChips({ value, onChange, coHosts }: BackstageChipsProps) {
  const [panel, setPanel] = useState<Panel>(null)
  const toggle = (next: Panel) => setPanel((open) => (open === next ? null : next))

  const chip = (on: boolean) =>
    `inline-flex h-11 items-center gap-2 rounded-full border-2 pl-3 pr-4 text-sm transition-colors ${
      on
        ? 'border-pastel-green/70 bg-white/10 font-semibold text-white'
        : 'border-dashed border-white/40 bg-transparent font-medium text-white/80'
    }`

  const option = (selected: boolean) =>
    `flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left ${
      selected ? 'bg-eco-beige/50 ring-2 ring-eco-green' : 'hover:bg-gray-50'
    }`

  return (
    <section aria-labelledby="backstage-heading" className="space-y-4 rounded-xl bg-eco-green p-5 text-eco-beige">
      <div>
        <h3 id="backstage-heading" className="text-lg font-bold text-white">
          Backstage
        </h3>
        <p className="text-sm text-white/75">Only you see this. Change any of it later.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" aria-expanded={panel === 'who'} onClick={() => toggle('who')} className={chip(true)}>
          {value.is_public ? <Globe className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
          {value.is_public ? 'Public' : 'Invited only'}
        </button>
        <button
          type="button"
          aria-pressed={value.has_rsvp}
          onClick={() => onChange({ has_rsvp: !value.has_rsvp })}
          className={chip(value.has_rsvp)}
        >
          {value.has_rsvp ? <Check className="h-4 w-4" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}
          {value.has_rsvp ? 'RSVP on' : 'RSVP off'}
        </button>
        <button
          type="button"
          aria-pressed={value.has_registry}
          onClick={() => onChange({ has_registry: !value.has_registry })}
          className={chip(value.has_registry)}
        >
          {value.has_registry ? <Check className="h-4 w-4" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}
          {value.has_registry ? 'Host catalog on' : 'Host catalog off'}
        </button>
        {coHosts?.href && (
          <Link href={coHosts.href} className={chip(coHosts.count > 0)}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            <span>
              {coHosts.count === 0 ? 'Co-hosts' : `${coHosts.count} co-host${coHosts.count === 1 ? '' : 's'}`}
              <span className="font-normal opacity-80"> · Manage</span>
            </span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
        {coHosts?.panel && (
          <button
            type="button"
            aria-expanded={panel === 'cohosts'}
            onClick={() => toggle('cohosts')}
            className={chip(coHosts.count > 0)}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {coHosts.count === 0 ? 'Co-hosts' : `${coHosts.count} co-host${coHosts.count === 1 ? '' : 's'}`}
          </button>
        )}
      </div>

      {panel === 'who' && (
        <div role="radiogroup" aria-label="Who can see this event" className="space-y-1 rounded-xl bg-white p-2 text-eco-green">
          <button
            type="button"
            role="radio"
            aria-checked={value.is_public}
            onClick={() => {
              onChange({ is_public: true })
              setPanel(null)
            }}
            className={option(value.is_public)}
          >
            <span className="font-semibold">Public</span>
            <span className="text-sm text-gray-600">
              Anyone with the link can view your invite, RSVP and use the host catalog.
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!value.is_public}
            onClick={() => {
              onChange({ is_public: false })
              setPanel(null)
            }}
            className={option(!value.is_public)}
          >
            <span className="font-semibold">Invited only</span>
            <span className="text-sm text-gray-600">Only people you’ve invited can take part.</span>
          </button>
        </div>
      )}

      {panel === 'cohosts' && coHosts && <div className="rounded-xl bg-white p-4 text-gray-900">{coHosts.panel}</div>}
    </section>
  )
}
