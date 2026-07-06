'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import api, { uploadImage } from '@/lib/api'
import type { DesignSample } from '@/lib/invite/api'
import { getEventPageConfig, updateEventPageConfig } from '@/lib/event/api'
import type { DesignTileSettings, InviteConfig, Tile } from '@/lib/invite/schema'
import WizardProgress from '@/components/host/WizardProgress'
import { logError } from '@/lib/error-handler'
import { Input } from '@/components/ui/input'
import DesignCatalogGrid, { useDesignCatalog } from '@/components/invite/DesignCatalogGrid'
import { deriveHarmoniousPalette } from '@/lib/invite/paletteUtils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRADIENT_PRESETS: { label: string; value: string }[] = [
  { label: 'Rose Blush',  value: 'linear-gradient(135deg, #fce4ec, #f48fb1)' },
  { label: 'Sage Mist',   value: 'linear-gradient(135deg, #e8f5e9, #81c784)' },
  { label: 'Dusk Blue',   value: 'linear-gradient(135deg, #e3f2fd, #64b5f6)' },
  { label: 'Golden Hour', value: 'linear-gradient(135deg, #fff8e1, #ffca28)' },
  { label: 'Lavender',    value: 'linear-gradient(135deg, #f3e5f5, #ce93d8)' },
  { label: 'Peach Cream', value: 'linear-gradient(135deg, #fff3e0, #ffb74d)' },
  { label: 'Midnight',    value: 'linear-gradient(135deg, #1a1a2e, #16213e)' },
  { label: 'Forest',      value: 'linear-gradient(135deg, #1b4332, #40916c)' },
]

// ---------------------------------------------------------------------------
// Main page
//
// This step is a pure background/color picker — it no longer hosts the text
// overlay canvas. Text editing for the `design` tile now happens in the Page
// Editor's tile settings panel (DesignTileSettings + TextOverlayEditorModal),
// which already supports the same drag/resize/font controls that used to
// live here. Picking a background writes straight into the `design` tile
// that the (now earlier) Layout step already created in page_config.
// ---------------------------------------------------------------------------

export default function DesignPage(): React.ReactElement {
  const params = useParams()
  const router = useRouter()
  const eventId = Number(params.eventId)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [event, setEvent] = useState<{ title: string; event_type: string } | null>(null)
  const [bgUrl, setBgUrl] = useState<string | null>(null)
  const [bgGradient, setBgGradient] = useState<string>(GRADIENT_PRESETS[0]!.value)
  const [hasSelectedBackground, setHasSelectedBackground] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sampleSearch, setSampleSearch] = useState('')

  // Paginated + server-searched background catalog, only while choosing.
  const catalog = useDesignCatalog({ enabled: !hasSelectedBackground, q: sampleSearch })

  // Load event + restore whatever the `design` tile already holds (e.g. the
  // layout's own default background, or a background picked on a previous visit).
  useEffect(() => {
    if (!eventId || isNaN(eventId)) return
    Promise.all([
      api.get<{ id: number; title: string; event_type: string }>(`/api/events/${eventId}/`),
      getEventPageConfig(eventId).catch(() => null),
    ]).then(([eventRes, pageConfig]) => {
      setEvent(eventRes.data)
      const designTile = pageConfig?.page_config?.tiles?.find((t) => t.type === 'design')
      const settings = designTile?.settings as DesignTileSettings | undefined
      if (settings?.src) {
        setBgUrl(settings.src)
        setHasSelectedBackground(true)
      } else if (settings?.backgroundGradient) {
        setBgGradient(settings.backgroundGradient)
        setHasSelectedBackground(true)
      }
    }).catch((err: unknown) => {
      logError('DesignPage: failed to load', err)
    })
  }, [eventId])

  // -------------------------------------------------------------------------
  // Save helpers
  // -------------------------------------------------------------------------

  async function saveBackground(nextBgUrl: string | null, nextBgGradient: string | null): Promise<boolean> {
    setSaving(true)
    try {
      const pageConfig = await getEventPageConfig(eventId)
      const existingConfig = pageConfig?.page_config
      const baseConfig: InviteConfig = existingConfig ?? { themeId: 'classic-noir', tiles: [] }

      // Derive a full, contrast-checked palette (background + legible text +
      // accent) from the chosen background — not just the page background —
      // so every tile that inherits from the theme (rather than baking its
      // own literal color) actually follows the host's pick.
      let customColors = baseConfig.customColors
      if (nextBgGradient || nextBgUrl) {
        const palette = await deriveHarmoniousPalette(nextBgUrl, nextBgGradient)
        customColors = {
          ...customColors,
          backgroundGradient: palette.backgroundGradient,
          backgroundColor: palette.backgroundColor,
          fontColor: palette.fontColor,
          primaryColor: palette.primaryColor,
        }
      }

      const cardSettings: DesignTileSettings = {
        src: nextBgUrl ?? undefined,
        backgroundGradient: nextBgUrl ? undefined : (nextBgGradient ?? undefined),
      }
      const hasDesignTile = baseConfig.tiles?.some((t) => t.type === 'design')
      let tiles: Tile[]
      if (hasDesignTile) {
        tiles = baseConfig.tiles!.map((t) =>
          t.type === 'design'
            ? { ...t, enabled: true, settings: { ...(t.settings as DesignTileSettings), ...cardSettings } }
            : t
        )
      } else {
        const maxOrder = Math.max(...(baseConfig.tiles?.map((t) => t.order ?? 0) ?? [0]), 0)
        tiles = [
          ...(baseConfig.tiles ?? []),
          { id: `tile-design-${Date.now().toString(36)}`, type: 'design' as const, enabled: true, order: maxOrder + 1, settings: cardSettings },
        ]
      }

      await updateEventPageConfig(eventId, { ...baseConfig, customColors, tiles })
      return true
    } catch (err) {
      logError('DesignPage: save failed', err)
      return false
    } finally {
      setSaving(false)
    }
  }

  // A fresh pick (sample/gradient/upload) saves and moves straight on to Page
  // Editor — there's nothing to review here that Page Editor's Design tile
  // settings don't already show. The "selected" screen below is only for
  // revisiting an already-configured background (e.g. via WizardProgress).
  async function applySampleBackground(sample: DesignSample): Promise<void> {
    const ok = await saveBackground(sample.background_image_url, null)
    if (ok) {
      router.push(`/host/events/${eventId}/page-editor`)
    } else {
      alert('Failed to save background. Please try again.')
    }
  }

  async function applyGradient(gradient: string): Promise<void> {
    const ok = await saveBackground(null, gradient)
    if (ok) {
      router.push(`/host/events/${eventId}/page-editor`)
    } else {
      alert('Failed to save background. Please try again.')
    }
  }

  async function handleUpload(file: File): Promise<void> {
    if (file.size > 10 * 1024 * 1024) {
      alert('Max file size is 10 MB.')
      return
    }
    setUploading(true)
    try {
      const url = await uploadImage(file, eventId)
      const ok = await saveBackground(url, null)
      if (ok) {
        router.push(`/host/events/${eventId}/page-editor`)
      } else {
        alert('Failed to save background. Please try again.')
      }
    } catch (err: unknown) {
      logError('DesignPage: upload failed', err)
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // -------------------------------------------------------------------------
  // Guard
  // -------------------------------------------------------------------------

  if (!eventId || isNaN(eventId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-red-500 text-sm">Invalid event ID.</p>
      </div>
    )
  }

  if (!hasSelectedBackground) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <WizardProgress currentStep={3} eventId={eventId} />

        <div className="max-w-7xl mx-auto w-full px-4 py-6 space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Choose your background</h1>
            <p className="text-sm text-gray-600 mt-1">
              Pick a background or color for your invite. You'll add text and fine-tune everything
              in the page editor next.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                type="button"
                onClick={() => void applyGradient(GRADIENT_PRESETS[0]!.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Use Gradient
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Upload Background / GIF'}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/host/events/${eventId}/page-editor`)}
                className="ml-auto px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Skip Design
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleUpload(file)
              }}
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-semibold text-gray-800">Ekfern Background Catalog</h2>
              <span className="text-xs text-gray-500">Select one to continue</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden />
              <Input
                type="search"
                value={sampleSearch}
                onChange={(e) => setSampleSearch(e.target.value)}
                placeholder="Search design backgrounds (typos OK)"
                className="pl-9 h-9 text-sm"
                aria-label="Search design backgrounds"
              />
            </div>
            <DesignCatalogGrid
              items={catalog.items}
              loading={catalog.loading}
              loadingMore={catalog.loadingMore}
              error={catalog.error}
              hasNext={catalog.hasNext}
              onSelect={(sample) => void applySampleBackground(sample)}
              onLoadMore={catalog.loadMore}
              onRetry={catalog.reload}
              emptyMessage={sampleSearch.trim() ? 'No samples match your search.' : 'No samples available yet. Upload your own background using “Upload Background”.'}
            />
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Selected state: simple preview + confirm
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <WizardProgress currentStep={3} eventId={eventId} />

      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setHasSelectedBackground(false)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Change Background
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleUpload(file)
          }}
        />

        {event && (
          <span className="text-xs text-gray-500 truncate max-w-[180px]">{event.title}</span>
        )}

        <div className="ml-auto flex items-center gap-3">
          {saving && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />
              Saving…
            </span>
          )}
          {bgUrl && (
            <span className="text-xs text-green-700 font-medium bg-green-50 px-2 py-1 rounded">
              Custom image active
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-6">
        <div
          style={{ height: '72vh', aspectRatio: '9 / 16' }}
          className="relative rounded-2xl shadow-2xl overflow-hidden"
        >
          {bgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bgUrl}
              alt="Background preview"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0" style={{ background: bgGradient }} />
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>

        <button
          type="button"
          onClick={() => router.push(`/host/events/${eventId}/page-editor`)}
          disabled={saving}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Next: Customize your invite'}
        </button>
      </div>
    </div>
  )
}
