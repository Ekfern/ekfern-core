'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logError } from '@/lib/error-handler'
import WizardProgress from '@/components/host/WizardProgress'
import PageLayoutLibrary from '@/components/invite/PageLayoutLibrary'
import {
  getInvitePageLayouts,
  getInvitePage,
  createInvitePage,
  updateInvitePage,
  getDesignSample,
  getDesignSampleByBackgroundUrl,
} from '@/lib/invite/api'
import { applyLayout } from '@/lib/invite/applyLayout'
import type { InvitePageLayout } from '@/lib/invite/pageLayouts'
import type { ImageTileSettings, DesignTileSettings, TextOverlay, InviteConfig } from '@/lib/invite/schema'
import { updateEventPageConfig } from '@/lib/event/api'
import api from '@/lib/api'
import { extractDominantColors, rgbToHex } from '@/lib/invite/imageAnalysis'
import { loadSelectedDesignContext, saveSelectedDesignContext, type SelectedDesignContext } from '@/lib/invite/designContext'
import { buildStarterLayouts, isStarterLayoutId } from '@/lib/invite/starterLayouts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EventData {
  id: number
  title: string
  date?: string
  city?: string
}

/**
 * Applies the card designer's background URL + text boxes to the invite config.
 * Sets the image tile src, fitMode, and textOverlays directly on the ImageTile.
 * Coordinates are stored with the same 9:16 system as the card designer canvas —
 * no translation needed.
 */
function applyCardDesignToConfig(
  config: InviteConfig,
  bgUrl: string | null,
  bgGradient: string | null,
  textBoxes: TextOverlay[] | null,
): InviteConfig {
  if (!config.tiles) return config

  const hasDesignTiles = config.tiles.some((t) => t.type === 'design')
  const updatedTiles = config.tiles.map((t) => {
    // Prefer the dedicated greeting-card tile type when present.
    if (hasDesignTiles) {
      if (t.type !== 'design') return t
      return {
        ...t,
        enabled: true,
        settings: {
          ...(t.settings as DesignTileSettings),
          src: bgUrl ?? undefined,
          backgroundGradient: bgUrl ? undefined : (bgGradient ?? undefined),
          textOverlays: textBoxes ?? undefined,
        },
      }
    }

    // Backwards-compat: if a template only has `image` tiles, preserve the legacy behavior.
    if (t.type !== 'image') return t
    return {
      ...t,
      settings: {
        ...(t.settings as ImageTileSettings),
        src: bgUrl ?? undefined,
        backgroundGradient: bgUrl ? undefined : (bgGradient ?? undefined),
        fitMode: 'full-image' as const,
        textOverlays: textBoxes ?? undefined,
      },
    }
  })
  return { ...config, tiles: updatedTiles }
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function LayoutSelectPage(): React.ReactElement {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()

  const eventId = params.eventId ? parseInt(params.eventId as string, 10) : 0

  const [layouts, setLayouts] = useState<InvitePageLayout[]>([])
  const [layoutsLoading, setLayoutsLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [event, setEvent] = useState<EventData | null>(null)
  const [pendingLayoutId, setPendingLayoutId] = useState<string | null>(null)
  const [designContext, setDesignContext] = useState<SelectedDesignContext | null>(null)
  const [starterLayouts, setStarterLayouts] = useState<InvitePageLayout[]>([])
  const [startersLoading, setStartersLoading] = useState(false)

  // Layouts are narrowed to the selected design via its stable code
  // (designContext.sampleCode -> ?design_code=). The "Show all layouts" toggle
  // clears the narrowing. Free-text search of the visible set is handled
  // client-side by PageLayoutLibrary's fuzzy filter.
  const [showAllLayouts, setShowAllLayouts] = useState(false)
  const [filterInitialized, setFilterInitialized] = useState(false)

  // Initialize from the selected design (and load event data).
  useEffect(() => {
    if (!eventId || isNaN(eventId)) return
    let cancelled = false
    const context = loadSelectedDesignContext(eventId)
    setDesignContext(context)

    // Back-compat: selections saved before design codes existed have a bgUrl
    // (and maybe a sampleId) but no sampleCode. Resolve the code once from the
    // catalog and upgrade the stored context so filtering + the chip work.
    const needsHydration =
      !!context &&
      context.sourceType === 'sample' &&
      !context.sampleCode?.trim() &&
      (!!context.sampleId || !!context.bgUrl?.trim())

    if (needsHydration && context) {
      const resolver = context.sampleId
        ? getDesignSample(context.sampleId).catch(() => null)
        : getDesignSampleByBackgroundUrl(context.bgUrl ?? '')
      resolver.then((sample) => {
        if (cancelled) return
        if (sample?.code) {
          const upgraded: SelectedDesignContext = {
            ...context,
            sampleId: sample.id,
            sampleCode: sample.code,
            sampleName: sample.name || context.sampleName,
            sampleTags: sample.tags ?? context.sampleTags,
          }
          saveSelectedDesignContext(upgraded)
          setDesignContext(upgraded)
          setShowAllLayouts(false)
        } else {
          // No matching catalog design -> nothing to narrow by.
          setShowAllLayouts(true)
        }
        setFilterInitialized(true)
      })
    } else {
      // No design code (uploads/gradients) -> nothing to narrow by, show all.
      setShowAllLayouts(!context?.sampleCode?.trim())
      setFilterInitialized(true)
    }

    api
      .get<EventData>(`/api/events/${eventId}/`)
      .then((res) => setEvent(res.data))
      .catch(() => { /* non-fatal — apply flow falls back to no event title */ })

    return () => {
      cancelled = true
    }
  }, [eventId])

  const designCode = designContext?.sampleCode?.trim() ?? ''
  const designFilterActive = !showAllLayouts && !!designCode

  // Fetch layouts: narrowed to the design (server design_code filter) or all.
  useEffect(() => {
    if (!eventId || isNaN(eventId) || !filterInitialized) return
    setLayoutsLoading(true)
    getInvitePageLayouts(designFilterActive ? { designCode } : undefined)
      .then(setLayouts)
      .catch(() => setLayouts([]))
      .finally(() => setLayoutsLoading(false))
  }, [eventId, filterInitialized, designFilterActive, designCode])

  const showStarters =
    designFilterActive && !layoutsLoading && layouts.length === 0 && starterLayouts.length > 0

  // Build mechanical starters when the design filter returns no staff layouts.
  useEffect(() => {
    if (!designFilterActive || layoutsLoading || layouts.length > 0) {
      setStarterLayouts([])
      setStartersLoading(false)
      return
    }
    let cancelled = false
    setStartersLoading(true)
    buildStarterLayouts(designContext)
      .then((list) => {
        if (!cancelled) setStarterLayouts(list)
      })
      .catch(() => {
        if (!cancelled) setStarterLayouts([])
      })
      .finally(() => {
        if (!cancelled) setStartersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [designFilterActive, layoutsLoading, layouts.length, designContext])

  function readCardDesignFromStorage(): { bgUrl: string | null; bgGradient: string | null; textBoxes: TextOverlay[] | null } {
    const context = loadSelectedDesignContext(eventId)
    const bgUrl = context?.bgUrl ?? localStorage.getItem(`card-bg-${eventId}`)
    const bgGradient = context?.bgGradient ?? localStorage.getItem(`card-gradient-${eventId}`)
    let textBoxes: TextOverlay[] | null = null
    try {
      const raw = context?.textOverlays ? JSON.stringify(context.textOverlays) : localStorage.getItem(`card-textboxes-${eventId}`)
      if (raw) textBoxes = JSON.parse(raw) as TextOverlay[]
    } catch { /* ignore parse errors */ }
    return { bgUrl, bgGradient, textBoxes }
  }

  async function applyDesignDrivenBackground(
    config: InviteConfig,
    bgUrl: string | null,
    bgGradient: string | null,
  ): Promise<InviteConfig> {
    if (bgGradient) {
      return {
        ...config,
        customColors: {
          ...config.customColors,
          backgroundGradient: bgGradient,
        },
      }
    }
    if (bgUrl) {
      try {
        const colors = await extractDominantColors(bgUrl, 1)
        const primary = rgbToHex(colors[0] ?? 'rgb(232,216,195)')
        return {
          ...config,
          customColors: {
            ...config.customColors,
            backgroundGradient: undefined,
            backgroundColor: primary,
          },
        }
      } catch {
        return config
      }
    }
    return config
  }

  async function handleLayoutSelect(layoutId: string): Promise<void> {
    const isStarter = isStarterLayoutId(layoutId)
    const layout = isStarter
      ? starterLayouts.find((t) => t.id === layoutId)
      : layouts.find((t) => t.id === layoutId)
    if (!layout) {
      showToast('Layout not found.', 'error')
      return
    }

    setApplying(true)
    setApplyingId(layoutId)
    try {
      let appliedConfig = isStarter
        ? applyLayout(layout.config, undefined, {
            mergeEventIntoTitle: false,
            mergeEventIntoDetails: false,
          })
        : applyLayout(layout.config, {
            title: event?.title,
            date: event?.date,
            city: event?.city,
          })

      // Apply card designer background + text overlays from step 2
      const { bgUrl, bgGradient, textBoxes } = readCardDesignFromStorage()
      if (bgUrl || bgGradient) {
        appliedConfig = applyCardDesignToConfig(appliedConfig, bgUrl, bgGradient, textBoxes)
        appliedConfig = await applyDesignDrivenBackground(appliedConfig, bgUrl, bgGradient)
      }

      // Save to Event.page_config so the design page reads the layout + card bg
      await updateEventPageConfig(eventId, appliedConfig)

      // Also sync to InvitePage model for publish flow
      const existing = await getInvitePage(eventId)
      if (existing) {
        await updateInvitePage(eventId, { config: appliedConfig })
      } else {
        await createInvitePage(eventId, { config: appliedConfig })
      }

      showToast('Layout applied! Customize it on the next step.', 'success')
      router.push(`/host/events/${eventId}/page-editor`)
    } catch (err: unknown) {
      logError('Failed to apply layout:', err)
      showToast(getErrorMessage(err), 'error')
    } finally {
      setApplying(false)
      setApplyingId(null)
    }
  }

  async function handleBlankCanvas(): Promise<void> {
    const { bgUrl, bgGradient, textBoxes } = readCardDesignFromStorage()
    if (bgUrl || bgGradient) {
      setApplying(true)
      setApplyingId('blank')
      try {
        const existing = await getInvitePage(eventId)
        const baseConfig = existing?.config
        if (baseConfig) {
          let updated = applyCardDesignToConfig(baseConfig, bgUrl, bgGradient, textBoxes)
          updated = await applyDesignDrivenBackground(updated, bgUrl, bgGradient)
          await updateEventPageConfig(eventId, updated)
          await updateInvitePage(eventId, { config: updated })
        }
      } catch {
        // Non-fatal — design page will still open correctly
      } finally {
        setApplying(false)
        setApplyingId(null)
      }
    }
    router.push(`/host/events/${eventId}/page-editor`)
  }

  if (!eventId || isNaN(eventId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-eco-beige">
        <p className="text-red-500">Invalid event ID.</p>
      </div>
    )
  }

  const pendingLayout =
    layouts.find((t) => t.id === pendingLayoutId) ??
    starterLayouts.find((t) => t.id === pendingLayoutId)
  const designLabel = designContext?.sampleName || designContext?.sourceType

  return (
    <div className="min-h-screen bg-eco-beige pb-24">
      <WizardProgress currentStep={3} eventId={eventId} />

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Back link */}
        <button
          type="button"
          onClick={() => router.push(`/host/events/${eventId}/design`)}
          className="flex items-center gap-1 text-sm text-eco-green hover:underline mb-6"
        >
          <span aria-hidden>&#8592;</span> Back to Design
        </button>

        <h1 className="text-3xl font-bold text-eco-green mb-1">Choose your invite layout</h1>
        <p className="text-gray-600 mb-4 text-sm">
          {designFilterActive
            ? 'Showing layouts created for your selected design. Switch to all layouts to browse everything.'
            : 'Pick a starting point. You can customize everything on the next step.'}
        </p>

        {/* Selected design indicator + filter toggle */}
        {designLabel && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Selected design</span>
            <span className="inline-flex items-center rounded-full bg-eco-green/10 border border-eco-green/30 px-3 py-1 text-xs text-eco-green font-medium">
              {designContext?.sampleCode || designLabel}
            </span>
            {designCode && (
              <button
                type="button"
                onClick={() => setShowAllLayouts((v) => !v)}
                className="text-xs text-eco-green underline hover:no-underline"
              >
                {designFilterActive ? 'Show all layouts' : 'Filter to this design'}
              </button>
            )}
          </div>
        )}

        {layoutsLoading || (designFilterActive && layouts.length === 0 && startersLoading) ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-eco-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className={`relative transition-opacity duration-200 ${applying ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Inline spinner centred over the grid while applying */}
            {applying && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-start pt-24 gap-3">
                <div className="w-10 h-10 border-4 border-eco-green border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium text-eco-green bg-white/80 px-3 py-1 rounded-full">
                  {applyingId === 'blank' ? 'Opening canvas...' : 'Applying layout...'}
                </p>
              </div>
            )}

            <PageLayoutLibrary
              layouts={layouts}
              starterLayouts={starterLayouts}
              showStarters={showStarters}
              onSelect={setPendingLayoutId}
              selectedId={pendingLayoutId ?? undefined}
              onBlankCanvas={handleBlankCanvas}
              designFilterActive={designFilterActive}
              onShowAllLayouts={() => setShowAllLayouts(true)}
            />
          </div>
        )}
      </div>

      {/* Sticky apply bar */}
      {pendingLayout && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-gray-800 truncate">
              <span className="text-gray-500 font-normal">Selected: </span>{pendingLayout.name}
            </p>
            <div className="flex gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setPendingLayoutId(null)}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={applying}
                onClick={() => handleLayoutSelect(pendingLayout.id)}
                className="bg-eco-green hover:bg-eco-green-dark disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
              >
                {applying ? 'Applying...' : 'Apply layout →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
