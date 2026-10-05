'use client'

import React, { useEffect, useMemo, useState } from 'react'
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
import { invitationIsLaidOut } from '@/lib/invite/eventDetailsContent'
import { completedSteps, type WizardEvent } from '@/lib/host/wizardSteps'
import type { InvitePageLayout } from '@/lib/invite/pageLayouts'
import type { InviteConfig } from '@/lib/invite/schema'
import { getEventPageConfig, updateEventPageConfig } from '@/lib/event/api'
import api from '@/lib/api'
import { buildStarterLayouts, isStarterLayoutId } from '@/lib/invite/starterLayouts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EventData extends WizardEvent {
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
  // What's actually applied to the event (vs. pendingLayoutId, which also
  // tracks the user's in-progress click on a different card). Used only to
  // pin the current layout to the front of the grid on load.
  const [appliedLayoutId, setAppliedLayoutId] = useState<string | null>(null)
  // The invitation as it stands, so what the host already wrote in its tiles
  // (time, venue, dress code) is carried into whichever layout they pick.
  const [currentConfig, setCurrentConfig] = useState<InviteConfig | null>(null)

  // Load event data (title/date/city merged into the applied layout's tiles).
  useEffect(() => {
    if (!eventId || isNaN(eventId)) return
    api
      .get<EventData>(`/api/events/${eventId}/`)
      .then((res) => setEvent(res.data))
      .catch(() => { /* non-fatal — apply flow falls back to no event title */ })
  }, [eventId])

  // Highlight whatever layout is already applied when revisiting this step.
  // Guarded with prev ?? id so it never clobbers a selection the user already
  // made by clicking a card before this load resolves.
  useEffect(() => {
    if (!eventId || isNaN(eventId)) return
    getEventPageConfig(eventId)
      .then((res) => {
        if (res?.page_config) setCurrentConfig(res.page_config)
        const appliedId = res?.page_config?.appliedLayoutId
        if (appliedId) {
          setPendingLayoutId((prev) => prev ?? appliedId)
          setAppliedLayoutId(appliedId)
        }
      })
      .catch(() => { /* non-fatal — just skip the highlight */ })
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

  // Pin the currently-applied layout to the front of the grid so it's the
  // first thing you see when revisiting this step, instead of having to hunt
  // for it among 30+ cards.
  const orderedLayouts = useMemo(() => {
    if (!appliedLayoutId) return layouts
    const index = layouts.findIndex((l) => l.id === appliedLayoutId)
    if (index <= 0) return layouts
    const applied = layouts[index]!
    return [applied, ...layouts.slice(0, index), ...layouts.slice(index + 1)]
  }, [layouts, appliedLayoutId])

  const orderedStarterLayouts = useMemo(() => {
    if (!appliedLayoutId) return starterLayouts
    const index = starterLayouts.findIndex((l) => l.id === appliedLayoutId)
    if (index <= 0) return starterLayouts
    const applied = starterLayouts[index]!
    return [applied, ...starterLayouts.slice(0, index), ...starterLayouts.slice(index + 1)]
  }, [starterLayouts, appliedLayoutId])

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

    // The invitation as it stands, read now rather than trusting the copy loaded
    // in the background - a host who picks a layout before that load finishes
    // would otherwise lose what they typed at creation.
    setApplying(true)
    setApplyingId(layoutId)
    let current = currentConfig
    try {
      current = (await getEventPageConfig(eventId))?.page_config ?? null
    } catch {
      // Fall back to whatever loaded; the layout still applies.
    }
    // The layout the invitation was last given, so its untouched samples stay behind.
    const previousId = current?.appliedLayoutId
    const previousLayoutConfig =
      (previousId &&
        (layouts.find((t) => t.id === previousId) ?? starterLayouts.find((t) => t.id === previousId))?.config) ||
      null

    try {
      const appliedConfig = isStarter
        ? applyLayout(layout.config, undefined, {
            mergeEventIntoTitle: false,
            mergeEventIntoDetails: false,
          }, layout.id, current, previousLayoutConfig)
        : applyLayout(layout.config, {
            title: event?.title,
            date: event?.date,
            city: event?.city,
          }, undefined, layout.id, current, previousLayoutConfig)

      // Save to Event.page_config so the design page reads the layout's tiles
      await updateEventPageConfig(eventId, appliedConfig)

      // Also sync to InvitePage model for publish flow
      const existing = await getInvitePage(eventId)
      if (existing) {
        await updateInvitePage(eventId, { config: appliedConfig })
      } else {
        await createInvitePage(eventId, { config: appliedConfig })
      }

      showToast('Layout applied!', 'success')
      router.push(`/host/events/${eventId}/page-editor`)
    } catch (err: unknown) {
      logError('Failed to apply layout:', err)
      showToast(getErrorMessage(err), 'error')
    } finally {
      setApplying(false)
      setApplyingId(null)
    }
  }

  function handleBlankCanvas(): void {
    // No config to apply — the page editor seeds its own defaults when the
    // event has none, so starting from scratch needs nothing written here.
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

  // Already laid out: this step is a place to come back to, not to walk through.
  // Keeping the current layout must not re-apply it - applying resets the
  // colours and fonts the host set in the editor.
  const laidOut = invitationIsLaidOut(currentConfig) || (event ? completedSteps(event).layout : false)
  const currentLayout =
    layouts.find((t) => t.id === appliedLayoutId) ?? starterLayouts.find((t) => t.id === appliedLayoutId)
  const switching = laidOut && !!pendingLayout && pendingLayout.id !== appliedLayoutId
  const continueToEditor = () => router.push(`/host/events/${eventId}/page-editor`)

  return (
    <div className="min-h-screen bg-eco-beige pb-48 lg:pb-24">
      {/* Show the Sub-events step in the stepper for multi-sub-event (ENVELOPE) events. */}
      <WizardProgress
        currentStep="layout"
        eventId={eventId}
        includeSubEvents={event?.event_structure === 'ENVELOPE'}
      />

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Back link */}
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-eco-green hover:underline mb-6"
        >
          <span aria-hidden>&#8592;</span> Back
        </button>

        <h1 className="text-3xl font-bold text-eco-green mb-1">
          {laidOut ? 'Your layout' : 'Choose your invite layout'}
        </h1>
        <p className="text-gray-600 mb-4 text-sm">
          {laidOut
            ? 'Keep it and carry on, or pick another - your words and photos stay either way.'
            : 'Pick a starting point — you\'ll choose colors and a background next, then fine-tune everything in the page editor.'}
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
              layouts={orderedLayouts}
              starterLayouts={orderedStarterLayouts}
              showStarters={showStarters}
              onSelect={setPendingLayoutId}
              selectedId={pendingLayoutId ?? undefined}
              onBlankCanvas={handleBlankCanvas}
            />
          </div>
        )}
      </div>

      {/* Laid out, current layout selected (or none picked): keep it and move on. */}
      {laidOut && !switching && (
        <div className="fixed inset-x-3 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+5.5rem)] z-40 rounded-2xl border border-gray-200 bg-white shadow-lg lg:inset-x-0 lg:bottom-0 lg:rounded-none lg:border-x-0 lg:border-b-0">
          <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <p className="text-sm font-medium text-gray-800 sm:truncate">
              <span className="text-gray-500 font-normal">Current layout: </span>
              {currentLayout?.name ?? 'your own page'}
            </p>
            <button
              type="button"
              onClick={continueToEditor}
              className="flex-shrink-0 bg-eco-green hover:bg-eco-green-dark text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              Keep it and continue →
            </button>
          </div>
        </div>
      )}

      {/* Sticky apply bar: a first layout, or switching to another */}
      {pendingLayout && (!laidOut || switching) && (
        <div className="fixed inset-x-3 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+5.5rem)] z-40 rounded-2xl border border-gray-200 bg-white shadow-lg lg:inset-x-0 lg:bottom-0 lg:rounded-none lg:border-x-0 lg:border-b-0">
          <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 sm:truncate">
                <span className="text-gray-500 font-normal">Selected: </span>{pendingLayout.name}
              </p>
              {switching && (
                <p className="text-xs text-gray-600">
                  Your words and photos stay. Colours and fonts you changed in the editor go back to this layout’s.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setPendingLayoutId(laidOut ? appliedLayoutId : null)}
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
                {applying ? 'Applying...' : switching ? 'Switch to this layout' : 'Apply layout →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
