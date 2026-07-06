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
} from '@/lib/invite/api'
import { applyLayout } from '@/lib/invite/applyLayout'
import type { InvitePageLayout } from '@/lib/invite/pageLayouts'
import { updateEventPageConfig } from '@/lib/event/api'
import api from '@/lib/api'
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
  const [starterLayouts, setStarterLayouts] = useState<InvitePageLayout[]>([])
  const [startersLoading, setStartersLoading] = useState(false)

  // Load event data (title/date/city merged into the applied layout's tiles).
  useEffect(() => {
    if (!eventId || isNaN(eventId)) return
    api
      .get<EventData>(`/api/events/${eventId}/`)
      .then((res) => setEvent(res.data))
      .catch(() => { /* non-fatal — apply flow falls back to no event title */ })
  }, [eventId])

  // Layout now runs before Design, so there's no design to narrow the catalog
  // by — always fetch the full set. Design (next step) picks the background.
  useEffect(() => {
    if (!eventId || isNaN(eventId)) return
    setLayoutsLoading(true)
    getInvitePageLayouts()
      .then(setLayouts)
      .catch(() => setLayouts([]))
      .finally(() => setLayoutsLoading(false))
  }, [eventId])

  const showStarters = !layoutsLoading && layouts.length === 0 && starterLayouts.length > 0

  // Build mechanical starters when the catalog has nothing to show at all.
  useEffect(() => {
    if (layoutsLoading || layouts.length > 0) {
      setStarterLayouts([])
      setStartersLoading(false)
      return
    }
    let cancelled = false
    setStartersLoading(true)
    buildStarterLayouts()
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
  }, [layoutsLoading, layouts.length])

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
      const appliedConfig = isStarter
        ? applyLayout(layout.config, undefined, {
            mergeEventIntoTitle: false,
            mergeEventIntoDetails: false,
          })
        : applyLayout(layout.config, {
            title: event?.title,
            date: event?.date,
            city: event?.city,
          })

      // Save to Event.page_config so the design page reads the layout's tiles
      await updateEventPageConfig(eventId, appliedConfig)

      // Also sync to InvitePage model for publish flow
      const existing = await getInvitePage(eventId)
      if (existing) {
        await updateInvitePage(eventId, { config: appliedConfig })
      } else {
        await createInvitePage(eventId, { config: appliedConfig })
      }

      showToast('Layout applied! Now pick a background.', 'success')
      router.push(`/host/events/${eventId}/design`)
    } catch (err: unknown) {
      logError('Failed to apply layout:', err)
      showToast(getErrorMessage(err), 'error')
    } finally {
      setApplying(false)
      setApplyingId(null)
    }
  }

  function handleBlankCanvas(): void {
    router.push(`/host/events/${eventId}/design`)
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

  return (
    <div className="min-h-screen bg-eco-beige pb-24">
      <WizardProgress currentStep={2} eventId={eventId} />

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Back link */}
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-eco-green hover:underline mb-6"
        >
          <span aria-hidden>&#8592;</span> Back
        </button>

        <h1 className="text-3xl font-bold text-eco-green mb-1">Choose your invite layout</h1>
        <p className="text-gray-600 mb-4 text-sm">
          Pick a starting point — you'll choose colors and a background next, then fine-tune
          everything in the page editor.
        </p>

        {layoutsLoading || (layouts.length === 0 && startersLoading) ? (
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
