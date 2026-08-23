'use client'

import React from 'react'
import type { FeatureButtonsTileSettings } from '@/lib/invite/schema'
import { Input } from '@/components/ui/input'
import { ExternalLink } from 'lucide-react'

interface FeatureButtonsTileSettingsProps {
  settings: FeatureButtonsTileSettings
  onChange: (settings: FeatureButtonsTileSettings) => void
  hasRsvp?: boolean
  hasRegistry?: boolean
  eventId?: number
}

export default function FeatureButtonsTileSettings({ 
  settings, 
  onChange, 
  hasRsvp = false, 
  hasRegistry = false,
  eventId,
}: FeatureButtonsTileSettingsProps) {

  return (
    <div className="space-y-4">
      {/* Button style, corner radius and colour were here, and so were the card's
          own fill, border and shadow. Every one of them is the invitation's
          decision - a page with two button shapes on it was never something
          anyone chose. What is left is what this tile is for: whether there is a
          card at all, and what the buttons say. */}

      {/* RSVP Button Label */}
      {hasRsvp && (
        <div>
          <label className="block text-sm font-medium mb-2">RSVP Button Label</label>
          <Input
            type="text"
            value={settings.rsvpLabel ?? ''}
            onChange={(e) => onChange({ ...settings, rsvpLabel: e.target.value })}
            placeholder="RSVP"
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">
            Custom display name for the RSVP button
          </p>

          {eventId ? (
            <div className="mt-3">
              <a
                href={`/host/events/${eventId}/rsvp`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                <span>Configure RSVP Form</span>
                <ExternalLink className="w-4 h-4" />
              </a>
              <p className="text-xs text-gray-500 mt-1">
                Choose which fields guests see and map guest custom fields into the RSVP form.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Registry Button Label */}
      {hasRegistry && (
        <div>
          <label className="block text-sm font-medium mb-2">Catalog button label</label>
          <Input
            type="text"
            value={settings.registryLabel ?? ''}
            onChange={(e) => onChange({ ...settings, registryLabel: e.target.value })}
            placeholder="View catalog"
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">
            Custom display name for the catalog button on your invite
          </p>
        </div>
      )}
    </div>
  )
}

