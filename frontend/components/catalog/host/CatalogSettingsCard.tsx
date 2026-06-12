'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { HostCatalog } from '@/lib/catalog/types'
import { getCatalogTitlePlaceholder } from '@/lib/catalog/copy'
import { CATALOG_PRESETS, detectActivePreset } from '@/lib/catalog/presets'
import { CatalogIntroEditor } from './CatalogIntroEditor'

const PURPOSE_LABELS: Record<string, string> = {
  gifts: 'Gifts / Contributions',
  fundraiser: 'Fundraiser',
  products_services: 'Products or Services',
  event_addons: 'Event Add-ons',
  sponsorships: 'Sponsorships',
  general: 'General Catalog',
}

const ACCESS_OPTIONS = [
  {
    value: 'same_as_event' as const,
    label: 'Anyone with the link',
    hint: 'Same access as your event page — guests can open the catalog without RSVP.',
  },
  {
    value: 'after_rsvp' as const,
    label: 'After RSVP is submitted',
    hint: 'Guests must complete RSVP before they can browse or respond.',
  },
  {
    value: 'confirmed_only' as const,
    label: 'Confirmed attendees only',
    hint: 'Only guests who RSVP’d “yes” (attending) can use the catalog.',
  },
]

export function CatalogSettingsCard({
  catalog,
  onCatalogChange,
  onSave,
}: {
  catalog: HostCatalog
  onCatalogChange: (patch: Partial<HostCatalog>) => void
  onSave: (patch: Partial<HostCatalog>) => void
}) {
  const activePreset = detectActivePreset(catalog)

  function applyPreset(presetId: (typeof CATALOG_PRESETS)[number]['id']) {
    const preset = CATALOG_PRESETS.find((p) => p.id === presetId)
    if (preset) onSave(preset.patch)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wide">
          Catalog Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Catalog purpose</label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
            value={catalog.purpose}
            onChange={(e) =>
              onSave({ purpose: e.target.value as HostCatalog['purpose'] })
            }
          >
            {Object.entries(PURPOSE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Catalog title <span className="text-gray-400 font-normal">(shown to guests)</span>
          </label>
          <Input
            placeholder={getCatalogTitlePlaceholder(catalog.purpose)}
            value={catalog.catalog_title}
            onChange={(e) => onCatalogChange({ catalog_title: e.target.value })}
            onBlur={() => onSave({ catalog_title: catalog.catalog_title })}
          />
        </div>

        <CatalogIntroEditor
          value={catalog.intro_text || ''}
          onChange={(html) => onCatalogChange({ intro_text: html })}
          onSave={(html) => onSave({ intro_text: html })}
        />

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Quick setup</p>
          <div className="flex flex-wrap gap-2">
            {CATALOG_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  activePreset === preset.id
                    ? 'bg-eco-green text-white border-eco-green'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-eco-green'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {activePreset && (
            <p className="text-xs text-gray-500 mt-2">
              {CATALOG_PRESETS.find((p) => p.id === activePreset)?.description}
            </p>
          )}
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-700 mb-1">Who can open the catalog?</p>
          <p className="text-xs text-gray-500 mb-3">
            Applies to every link (invitation, RSVP, QR, or direct URL).
          </p>
          <div className="space-y-3">
            {ACCESS_OPTIONS.map(({ value, label, hint }) => (
              <label key={value} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="access_mode"
                  value={value}
                  checked={catalog.catalog_access_mode === value}
                  onChange={() => onSave({ catalog_access_mode: value })}
                  className="accent-eco-green mt-1"
                />
                <span>
                  <span className="text-sm text-gray-800 font-medium block">{label}</span>
                  <span className="text-xs text-gray-500">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-700 mb-1">Where should guests find it?</p>
          <p className="text-xs text-gray-500 mb-3">
            Direct URL and QR always work when shared; access rules above still apply.
          </p>
          <label className="flex items-start gap-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={catalog.show_on_event_page}
              onChange={(e) => onSave({ show_on_event_page: e.target.checked })}
              className="accent-eco-green mt-0.5"
            />
            <span>
              <span className="text-sm text-gray-800 font-medium block">Button on invitation</span>
              <span className="text-xs text-gray-500">Shows on your invite / event page</span>
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={catalog.show_on_rsvp_confirmation}
              onChange={(e) => onSave({ show_on_rsvp_confirmation: e.target.checked })}
              className="accent-eco-green mt-0.5"
            />
            <span>
              <span className="text-sm text-gray-800 font-medium block">Link after RSVP</span>
              <span className="text-xs text-gray-500">Shown on the RSVP confirmation step</span>
            </span>
          </label>
        </div>
      </CardContent>
    </Card>
  )
}
