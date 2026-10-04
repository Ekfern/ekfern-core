'use client'

import { X } from 'lucide-react'
import {
  CAPABILITY_LABELS,
  NOTIFICATION_LABELS,
  type CoHost,
  type CoHostCapability,
  type CoHostNotification,
} from '@/lib/cohosts'
import { formatChipDate } from '@/lib/cohostChips'

const CAPABILITY_ORDER: CoHostCapability[] = [
  'manage_guests',
  'send_messages',
  'edit_invitation',
  'edit_rsvp',
  'edit_catalog',
]
const NOTIFICATION_ORDER: CoHostNotification[] = ['rsvp_new', 'catalog_response']

function Switch({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span id={`${id}-label`} className="text-sm text-gray-800">
        {label}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-eco-green focus-visible:ring-offset-2 ${
          checked ? 'bg-eco-green' : 'bg-gray-300'
        }`}
      >
        <span
          aria-hidden
          className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

export interface CoHostSettingsProps {
  coHost: CoHost
  saving: boolean
  onCapabilityChange: (capability: CoHostCapability, on: boolean) => void
  onNotificationChange: (notification: CoHostNotification, on: boolean) => void
  onClose: () => void
}

/**
 * What an accepted co-host may change, and which host emails they get. Opened
 * by tapping their green chip; each switch saves as soon as it is flipped.
 */
export default function CoHostSettings({
  coHost,
  saving,
  onCapabilityChange,
  onNotificationChange,
  onClose,
}: CoHostSettingsProps) {
  const since = formatChipDate(coHost.accepted_at)
  return (
    <section
      aria-label={`Settings for ${coHost.name || coHost.email}`}
      className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-gray-900">{coHost.name || coHost.email}</p>
          <p className="text-xs text-gray-600 break-all">
            Invited as <span className="font-medium">{coHost.email}</span>
          </p>
          {since ? <p className="text-xs text-gray-500">Co-host since {since}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-eco-green"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Can manage</p>
          <div className="mt-1 divide-y divide-gray-100">
            {CAPABILITY_ORDER.map((cap) => (
              <Switch
                key={cap}
                id={`cohost-${coHost.id}-cap-${cap}`}
                label={CAPABILITY_LABELS[cap]}
                checked={coHost.capabilities.includes(cap)}
                disabled={saving}
                onChange={(on) => onCapabilityChange(cap, on)}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email them about</p>
          <div className="mt-1 divide-y divide-gray-100">
            {NOTIFICATION_ORDER.map((n) => (
              <Switch
                key={n}
                id={`cohost-${coHost.id}-notify-${n}`}
                label={NOTIFICATION_LABELS[n]}
                checked={coHost.notifications.includes(n)}
                disabled={saving}
                onChange={(on) => onNotificationChange(n, on)}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            How often they hear is their own choice in their notification settings.
          </p>
        </div>
      </div>
    </section>
  )
}
