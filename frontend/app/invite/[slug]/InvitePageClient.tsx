'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { InviteConfig } from '@/lib/invite/schema'
import { resolveAppearance } from '@/lib/invite/appearance'
import { resolveAnimations } from '@/lib/invite/animations/resolve'
import { primaryAnimationId } from '@/lib/invite/animations/types'
import { eventFromInvitePayload, type InviteEvent } from '@/lib/invite/inviteEvent'
import InviteRenderer from '@/components/invite/render/InviteRenderer'
import { logError, logDebug } from '@/lib/error-handler'
import api from '@/lib/api'
import TextureOverlay from '@/components/invite/render/TextureOverlay'
import OpeningLayer from '@/components/invite/animations/OpeningLayer'
import ExperienceLayer from '@/components/invite/animations/ExperienceLayer'
import PoweredByBranding from '@/components/invite/PoweredByBranding'
import ComingSoon from '@/components/invite/ComingSoon'
import {
  getCatalogButtonLabel,
  shouldShowCatalogOnEventPage,
} from '@/lib/catalog/placement'
import { catalogUrl } from '@/lib/catalog/source'

// Helper for development-only logging
const isDev = process.env.NODE_ENV === 'development'
const devLog = (...args: any[]) => {
  if (isDev) console.log(...args)
}

interface InvitePageClientProps {
  slug: string
  initialEvent?: InviteEvent | null
  initialConfig?: InviteConfig | null
  /** Server-rendered markup for particular tiles, keyed by tile id. */
  ssrTiles?: Record<string, React.ReactNode>
  allowedSubEvents?: any[]
}

export default function InvitePageClient({ 
  slug, 
  initialEvent = null, 
  initialConfig = null,
  ssrTiles,
  allowedSubEvents = [],
}: InvitePageClientProps) {
  // Extract guest token from URL (most efficient - no state/effects needed)
  const searchParams = useSearchParams()
  const guestToken = searchParams.get('g') || searchParams.get('token')
  
  // Client-side lifecycle tracking
  const clientStartTime = typeof window !== 'undefined' ? Date.now() : 0
  
  // Log component mount/hydration
  if (typeof window !== 'undefined') {
    devLog('[InvitePageClient] ====== CLIENT COMPONENT MOUNT ======', {
      timestamp: new Date().toISOString(),
      slug,
      hasInitialEvent: !!initialEvent,
      hasInitialConfig: !!initialConfig,
      ssrTileCount: ssrTiles ? Object.keys(ssrTiles).length : 0,
      allowedSubEventsCount: allowedSubEvents.length,
      windowLocation: window.location.href,
    })
  }
  
  const [event, setEvent] = useState<InviteEvent | null>(initialEvent)
  const [config, setConfig] = useState<InviteConfig | null>(initialConfig)
  const [loading, setLoading] = useState(!initialConfig)
  const [subEvents, setSubEvents] = useState<any[]>(allowedSubEvents)
  const [error, setError] = useState<any>(null)
  // Set when the invite has been pulled back (unpublished). Polling keeps running so
  // the page automatically flips back to live once the host re-publishes.
  const [comingSoon, setComingSoon] = useState<{ title?: string; showBranding: boolean } | null>(null)
  
  // DEBUG: Log initial config order when invite page loads
  useEffect(() => {
    if (initialConfig?.tiles && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('[TILE ORDER DEBUG] Invite page initial config order:', {
        tiles: initialConfig.tiles.map(t => ({
          id: t.id,
          type: t.type,
          enabled: t.enabled,
          order: t.order,
          previewOrder: t.previewOrder,
        })),
        enabledTiles: initialConfig.tiles
          .filter(t => t.enabled)
          .sort((a, b) => a.order - b.order)
          .map(t => ({
            id: t.id,
            type: t.type,
            order: t.order,
          })),
      })
    }
  }, [initialConfig])
  
  // Log initial state
  if (typeof window !== 'undefined') {
    devLog('[InvitePageClient] 📦 STATE: Initial state set', {
      slug,
      hasEvent: !!event,
      hasConfig: !!config,
      loading,
      subEventsCount: subEvents.length,
    })
  }

  const fetchInvite = useCallback(async () => {
    const fetchStartTime = Date.now()
    devLog('[InvitePageClient] 📡 CLIENT COMMUNICATION: Starting client-side fetch', {
      slug,
      timestamp: new Date().toISOString(),
      elapsedSinceMount: fetchStartTime - clientStartTime,
    })
    try {
      // CRITICAL: Always use slug, never event ID for public invite pages
      // The public endpoint is /api/events/invite/{slug}/, NOT /api/events/{id}/invite/
      if (!slug || typeof slug !== 'string') {
        console.error('[InvitePageClient] Invalid slug:', slug)
        throw new Error('Invalid slug provided')
      }
      
      // Extract guest token and preview flag from URL
      const urlParams = new URLSearchParams(window.location.search)
      const guestToken = urlParams.get('g')
      const isPreview = urlParams.get('preview') === 'true'
      
      // Build query parameters
      const queryParams = new URLSearchParams()
      if (guestToken) {
        queryParams.append('g', guestToken)
      }
      if (isPreview) {
        queryParams.append('preview', 'true')
      }
      // Cache-busting: this client refetch exists to show the latest published
      // config. A unique param forces a CloudFront cache MISS so we always read
      // fresh data from origin (where Django cache is invalidated on save/publish),
      // instead of up-to-5-min-stale CDN data.
      queryParams.append('_ts', Date.now().toString())
      const queryString = queryParams.toString()
      
      // ALWAYS use the public invite endpoint with slug (never event ID)
      const inviteUrl = queryString
        ? `/api/events/invite/${slug}/?${queryString}`
        : `/api/events/invite/${slug}/`
      
      // Validate URL format - must use /api/events/invite/{slug}/ pattern
      if (!inviteUrl.startsWith('/api/events/invite/')) {
        console.error('[InvitePageClient] Invalid invite URL format:', inviteUrl)
        throw new Error('Invalid invite URL format - must use /api/events/invite/{slug}/')
      }
      
      devLog('[InvitePageClient] 📡 CLIENT COMMUNICATION: Fetching invite data', {
        slug,
        inviteUrl,
        apiBase: api.defaults.baseURL,
        fullUrl: `${api.defaults.baseURL}${inviteUrl}`,
        guestToken: guestToken ? 'present' : 'none',
        timestamp: new Date().toISOString(),
      })
      
      const apiCallStart = Date.now()
      // Use _ts cache-busting only (no Cache-Control request headers): custom headers
      // trigger a CORS preflight that fails unless the API allows them explicitly.
      const response = await api.get(inviteUrl)
      const apiCallEnd = Date.now()
      const inviteData = response.data
      
      devLog('[InvitePageClient] ✅ CLIENT COMMUNICATION: API call succeeded', {
        slug,
        duration: `${apiCallEnd - apiCallStart}ms`,
        dataSize: JSON.stringify(inviteData).length,
        status: response.status,
      })

      // Invite was pulled back: render the Coming Soon placeholder. Polling keeps
      // running, so the page recovers automatically once the host re-publishes.
      if (inviteData && inviteData.status === 'coming_soon') {
        setComingSoon({ title: inviteData.title, showBranding: inviteData.show_branding !== false })
        setError(null)
        setLoading(false)
        return
      }
      // Live again (or normal live page) — clear any prior coming-soon state.
      setComingSoon(null)
      
      // Extract event data and allowed_sub_events
      const dataProcessingStart = Date.now()
      devLog('[InvitePageClient] 🔄 CLIENT DATA PROCESSING: Processing response data', {
        slug,
        timestamp: new Date().toISOString(),
      })
      
      const eventData = eventFromInvitePayload(inviteData)
      
      if (inviteData.allowed_sub_events) {
        setSubEvents(inviteData.allowed_sub_events)
        devLog('[InvitePageClient] ✅ CLIENT DATA PROCESSING: Sub-events set', {
          slug,
          subEventsCount: inviteData.allowed_sub_events.length,
        })
      }

      if (eventData?.page_config) {
        devLog('[InvitePageClient] 🔄 CLIENT DATA PROCESSING: Processing page config', {
          slug,
          hasConfig: !!eventData.page_config,
        })
        // Use page_config from API (supports both legacy hero-based and new tile-based configs)
        // Preserve customColors - check if it's an object and has properties
        let customColors = undefined
        if (eventData.page_config.customColors !== undefined) {
          // If customColors exists, use it (even if empty object)
          if (typeof eventData.page_config.customColors === 'object' && eventData.page_config.customColors !== null) {
            customColors = eventData.page_config.customColors
          } else {
            customColors = eventData.page_config.customColors
          }
        }
        
        // Preserve all config properties including pageBorder and pageFrame
        const configWithCustomColors = {
          ...eventData.page_config,
          customColors,
          ...(eventData.page_config.pageBorder && { pageBorder: eventData.page_config.pageBorder }),
          ...(eventData.page_config.pageFrame && { pageFrame: eventData.page_config.pageFrame }),
          ...(eventData.page_config.cornerDecorations && { cornerDecorations: eventData.page_config.cornerDecorations }),
        }
        
        // Debug: note when the poster is present on a public page load
        const posterTile = configWithCustomColors.tiles?.find((t: any) => t.type === 'poster')
        if (posterTile) {
          logDebug('[Public Invite Page] Poster tile loaded')
        }
        
        setEvent(eventData)
        setConfig(configWithCustomColors)
        
        const dataProcessingEnd = Date.now()
        devLog('[InvitePageClient] ✅ CLIENT DATA PROCESSING: Config processed and state updated', {
          slug,
          duration: `${dataProcessingEnd - dataProcessingStart}ms`,
          totalFetchDuration: `${dataProcessingEnd - fetchStartTime}ms`,
        })
        setLoading(false)
      } else {
        devLog('[InvitePageClient] ⚠️ CLIENT DATA PROCESSING: No page config, using fallback', {
          slug,
        })
        // Fallback: create config from event data
        const fallbackConfig: InviteConfig = {
          hero: {
            title: eventData.title || 'Event',
            subtitle: eventData.description ? eventData.description.substring(0, 100) : undefined,
            showTimer: !!eventData.date,
            eventDate: eventData.date,
            buttons: [
              { label: 'Save the Date', action: 'calendar' },
              ...(eventData.has_rsvp
                ? [{ label: 'RSVP' as const, action: 'rsvp' as const, href: `/event/${slug}/rsvp` }]
                : []),
              ...(shouldShowCatalogOnEventPage(
                eventData.has_registry,
                eventData.catalog_show_on_event_page,
              )
                ? [
                    {
                      label: getCatalogButtonLabel(
                        eventData.catalog_title,
                        eventData.catalog_purpose || 'general',
                      ) as 'Gift Catalog',
                      action: 'registry' as const,
                      href: catalogUrl(slug, { source: 'invite' }),
                    },
                  ]
                : []),
            ],
          },
          descriptionMarkdown: eventData.description || undefined,
        }
        setEvent(eventData)
        setConfig(fallbackConfig)
        
        const dataProcessingEnd = Date.now()
        devLog('[InvitePageClient] ✅ CLIENT DATA PROCESSING: Fallback config created and state updated', {
          slug,
          duration: `${dataProcessingEnd - dataProcessingStart}ms`,
          totalFetchDuration: `${dataProcessingEnd - fetchStartTime}ms`,
        })
        setLoading(false)
      }
    } catch (error: any) {
      const fetchEndTime = Date.now()
      console.error('[InvitePageClient] ❌ CLIENT COMMUNICATION: API call failed', {
        slug,
        duration: `${fetchEndTime - fetchStartTime}ms`,
        error: error.message,
        errorType: error.name,
        timestamp: new Date().toISOString(),
      })
      
      // Capture FULL error details for display
      const fullErrorDetails = {
        type: 'CLIENT_FETCH_ERROR',
        message: error.message,
        name: error.name,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        requestUrl: error.config?.url,
        requestBaseURL: error.config?.baseURL,
        fullUrl: error.config ? `${error.config.baseURL}${error.config.url}` : 'unknown',
        apiBase: api.defaults.baseURL,
        slug,
        stack: error.stack,
        headers: error.response?.headers,
      }
      
      console.error('[InvitePageClient] Failed to fetch invite:', fullErrorDetails)
      logError('Failed to fetch invite:', error)
      
      // Set error state with full details
      setError(fullErrorDetails)
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    const effectStartTime = Date.now()
    devLog('[InvitePageClient] 🔄 CLIENT EFFECT: useEffect triggered (data fetch check)', {
      slug,
      hasInitialConfig: !!initialConfig,
      hasInitialEvent: !!initialEvent,
      timestamp: new Date().toISOString(),
      elapsedSinceMount: effectStartTime - clientStartTime,
    })
    
    // Always fetch latest config from API. SSR/ISR may serve stale page_config (revalidate=300)
    // even after save/publish; background refresh ensures new tiles (e.g. description) appear.
    devLog('[InvitePageClient] 📡 CLIENT EFFECT: Refreshing invite config from API', {
      slug,
      hasInitialConfig: !!initialConfig,
      hasInitialEvent: !!initialEvent,
      elapsedSinceMount: Date.now() - clientStartTime,
    })
    fetchInvite()
  }, [slug, fetchInvite])

  // Listen for refresh messages using BroadcastChannel (industry standard)
  // This must be after fetchInvite is declared
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Check if we should listen for updates:
    // 1. Preview mode (always listen)
    // 2. User is authenticated (likely the host viewing their own page)
    const urlParams = new URLSearchParams(window.location.search)
    const isPreview = urlParams.get('preview') === 'true'
    const isAuthenticated = typeof localStorage !== 'undefined' && !!localStorage.getItem('access_token')
    
    // Only listen if in preview mode or user is authenticated (host viewing their page)
    if (!isPreview && !isAuthenticated) {
      return // Guest viewers don't need BroadcastChannel updates (they use polling)
    }
    
    // Use slug-based channel name for targeted updates (industry standard)
    const channelName = `invite-${slug}-updates`
    const channel = new BroadcastChannel(channelName)
    
    const handleMessage = (event: MessageEvent) => {
      // Check if message is to refresh the invite page
      if (event.data?.type === 'REFRESH_INVITE_PAGE' && event.data?.slug === slug) {
        devLog('[InvitePageClient] Received refresh message via BroadcastChannel, reloading data...', {
          slug,
          isPreview,
          isAuthenticated,
        })
        // Force refresh by fetching latest data
        fetchInvite()
      }
    }
    
    channel.addEventListener('message', handleMessage)
    return () => {
      channel.removeEventListener('message', handleMessage)
      channel.close()
    }
  }, [fetchInvite, slug])

  // Smart polling for guests (industry standard: 30 seconds, only when page visible)
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const urlParams = new URLSearchParams(window.location.search)
    const isPreview = urlParams.get('preview') === 'true'
    const isAuthenticated = typeof localStorage !== 'undefined' && !!localStorage.getItem('access_token')
    
    // Don't poll if in preview mode or authenticated (they get BroadcastChannel updates)
    if (isPreview || isAuthenticated) return
    
    // Smart polling (industry standard: 15 seconds for faster updates, only when visible)
    let pollInterval: NodeJS.Timeout | null = null
    let lastCheck = Date.now()
    
    const startPolling = () => {
      if (pollInterval) return // Already polling
      
      // Poll every 15 seconds for faster updates (industry standard: 10-60 seconds)
      pollInterval = setInterval(() => {
        // Only poll if page is visible (saves bandwidth)
        if (document.visibilityState === 'visible') {
          const now = Date.now()
          // Only fetch if it's been at least 15 seconds since last check
          if (now - lastCheck >= 15000) {
            devLog('[InvitePageClient] Polling for updates...')
            fetchInvite()
            lastCheck = now
          }
        }
      }, 15000) // 15 seconds for faster updates
    }
    
    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }
    }
    
    // Start polling when page is visible
    if (document.visibilityState === 'visible') {
      startPolling()
    }
    
    // Handle visibility changes (industry standard)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startPolling()
      } else {
        stopPolling()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchInvite, slug])

  // The config carries its own colours; appearance.ts holds the last-resort defaults.
  const backgroundColor = resolveAppearance(config).backgroundColor
  const pageBackground = config?.customColors?.backgroundGradient || backgroundColor

  // Set body background to match page background
  // This MUST be called before any early returns to follow React hooks rules
  useEffect(() => {
    devLog('[InvitePageClient] 🎨 CLIENT EFFECT: Setting background color', {
      slug,
      backgroundColor,
      hasBorder: config?.pageBorder?.enabled,
      timestamp: new Date().toISOString(),
    })
    
    // If border is enabled, use a contrasting color for body background so border is visible
    // Otherwise use the page background (solid color or gradient)
    const bodyBackground = config?.pageBorder?.enabled ? '#f5f5f5' : pageBackground

    document.body.style.setProperty('background', bodyBackground, 'important')
    document.documentElement.style.setProperty('background', bodyBackground, 'important')
    // Ensure body/html don't force extra height that creates unnecessary scrollbar
    document.body.style.setProperty('min-height', 'auto', 'important')
    document.documentElement.style.setProperty('min-height', 'auto', 'important')

    return () => {
      devLog('[InvitePageClient] 🧹 CLIENT EFFECT: Cleaning up background color', {
        slug,
      })
      document.body.style.removeProperty('background-color')
      document.body.style.removeProperty('background')
      document.body.style.removeProperty('min-height')
      document.documentElement.style.removeProperty('background-color')
      document.documentElement.style.removeProperty('background')
      document.documentElement.style.removeProperty('min-height')
    }
  }, [pageBackground, slug, config?.pageBorder?.enabled])

  // Pulled-back invite: show the branded Coming Soon page (polling continues so it
  // auto-recovers when the host re-publishes).
  if (comingSoon) {
    return <ComingSoon title={comingSoon.title} showBranding={comingSoon.showBranding} />
  }

  // Display error
  if (error) {
    devLog('[InvitePageClient] ⚠️ CLIENT RENDER: Rendering error state', {
      slug,
      errorType: error.type,
      timestamp: new Date().toISOString(),
      elapsedSinceMount: Date.now() - clientStartTime,
    })
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            Unable to load invite page
          </h1>
          <p className="text-gray-600">Please try again later.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    devLog('[InvitePageClient] ⏳ CLIENT RENDER: Rendering loading state', {
      slug,
      timestamp: new Date().toISOString(),
      elapsedSinceMount: Date.now() - clientStartTime,
    })

    // Do NOT mount OpeningLayer here. If the opening runs over the spinner and
    // marks itself seen, the real invite remounts a fresh layer and skips —
    // which is how Curtain Reveal looked like a no-op. Openings start only once
    // the invite content is ready below.
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">🌿</div>
          <p className="text-gray-600">Loading invitation...</p>
        </div>
      </div>
    )
  }

  if (!config) {
    devLog('[InvitePageClient] ⚠️ CLIENT RENDER: No config available', {
      slug,
      timestamp: new Date().toISOString(),
      elapsedSinceMount: Date.now() - clientStartTime,
    })
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 text-lg">Invitation not found</p>
        </div>
      </div>
    )
  }

  // If we have SSR content, filter out those tiles from config
  devLog('[InvitePageClient] 🎨 CLIENT RENDER: Preparing final render', {
    slug,
    hasConfig: !!config,
    ssrTileCount: ssrTiles ? Object.keys(ssrTiles).length : 0,
    tilesCount: config.tiles?.length || 0,
    timestamp: new Date().toISOString(),
    elapsedSinceMount: Date.now() - clientStartTime,
  })
  
  // The poster is no longer removed from the list - it keeps its place and the
  // renderer puts its server markup in that slot. The only tile still dropped
  // is a title that overlays the poster, which is drawn inside the poster's own
  // markup and would otherwise appear twice.
  const hasSsrTiles = !!ssrTiles && Object.keys(ssrTiles).length > 0
  const configForClient = hasSsrTiles ? {
    ...config,
    tiles: config.tiles?.filter(
      (tile) => !(tile.type === 'title' && tile.overlayTargetId),
    ) || []
  } : config
  
  const renderTime = Date.now()
  devLog('[InvitePageClient] ✅ CLIENT RENDER: Rendering InviteRenderer', {
    slug,
    hasConfig: !!configForClient,
    ssrTileCount: ssrTiles ? Object.keys(ssrTiles).length : 0,
    totalElapsed: `${renderTime - clientStartTime}ms`,
    timestamp: new Date().toISOString(),
  })
  
  devLog('[InvitePageClient] ====== CLIENT COMPONENT RENDER COMPLETE ======', {
    slug,
    totalDuration: renderTime - clientStartTime,
    timestamp: new Date().toISOString(),
  })

  // Resolve module IDs — guest page never branches on envelope / petals by name.
  // Config stores arrays; layers still take a single id (cap 1) via primaryAnimationId.
  const resolved = resolveAnimations(config.animations)
  const opening = primaryAnimationId(resolved.opening)
  const experience = primaryAnimationId(resolved.experience)
  const coverColor = pageBackground || '#E8D8C3'

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    devLog('[InvitePageClient] 🎬 Resolved animations', {
      slug,
      opening,
      experience,
      raw: config.animations,
    })
  }

  // Get page border styles
  const getPageBorderStyle = () => {
    // Debug: Always log pageBorder config
    devLog('[InvitePageClient] 🎨 Page Border Check', {
      hasPageBorder: !!config?.pageBorder,
      pageBorder: config?.pageBorder,
      enabled: config?.pageBorder?.enabled,
      fullConfig: config,
    })
    
    
    if (!config.pageBorder?.enabled) {
      return { 
        borderWidth: undefined,
        borderStyle: undefined,
        borderColor: undefined,
        boxShadow: undefined, 
        outline: undefined,
        outlineOffset: undefined,
        matte: undefined,
        mat: undefined,
      }
    }
    
    const borderStyle = config.pageBorder!.style || 'solid'
    const borderColor = config.pageBorder!.color || '#D1D5DB'
    const borderWidth = config.pageBorder!.width || 2

    /**
     * A frame is ornament, so it scales with the page it frames.
     *
     * These used to be fixed pixels: a 7px rule and a `max(width + 8, 12)`
     * matte, identical on a 1280px desktop and a 320px phone. Held still while
     * the page shrank, the same rule reads about three times heavier, and the
     * decoration ate 32% of a small screen's width - enough to wrap the date
     * onto two lines. The host's chosen width is now the value at a 1280px
     * page and everything narrower scales down from it.
     *
     * The floor is 2px because the intaglio is band / gap / band at one unit
     * each: under 2px the gap stops resolving on a non-retina screen and two
     * crisp lines become one grey smudge. Scaling the unit rather than the
     * total is what keeps that 1:1:1 ratio intact.
     */
    const REFERENCE_PAGE_WIDTH = 1280
    const scaled = (value: number, floor: number) =>
      `clamp(${floor}px, ${((value / REFERENCE_PAGE_WIDTH) * 100).toFixed(3)}vw, ${value}px)`

    const rule = scaled(borderWidth, 2)

    // Rhythm owns how much air the page keeps, so the frame's margins answer to
    // the host's spacing choice (12 / 16 / 24px) rather than to a constant.
    // `--inset-page` is published by AppearanceProvider, which renders inside
    // InviteRenderer - below this wrapper - so the value is resolved here in JS
    // instead of read as a custom property that would not be in scope.
    const insetPage = resolveAppearance(config).insetPage
    const insetMatch = /^([\d.]+)rem$/.exec(insetPage.trim())
    const insetPx = insetMatch ? parseFloat(insetMatch[1]) * 16 : 16
    // Outside the frame and inside it: a frame with content jammed against it
    // reads as a crop rather than a border.
    //
    // The gap you can see is the mat MINUS the frame, because the frame is
    // painted inside the same box the padding is measured from.
    //
    // Getting that backwards is what produced two rounds of wrong answers: a
    // 21px mat against a 21px rule left a visible gap of zero, which reads as
    // touching, and trimming it to 14px put the rule's inner band 7px on top of
    // the first line of text - the frame draws above the tiles, so the eyebrow
    // was overpainted rather than clipped. So the mat clears the frame first,
    // and only then adds the air.
    const gap = scaled(insetPx, 8)
    const frameExtent = borderStyle === 'intaglio' ? `calc(${rule} * 3)` : rule
    // Outside the frame there is nothing to clear, so the matte is just the air.
    const matte = gap
    const mat = `calc(${frameExtent} + ${gap})`

    devLog('[InvitePageClient] 🎨 Page Border Enabled - Applying Styles', {
      enabled: config.pageBorder!.enabled,
      style: borderStyle,
      color: borderColor,
      width: borderWidth,
      rule,
      insetPage,
      matte,
      mat,
    })
    
    // For intaglio (decorative), use a special pattern with box-shadow
    if (borderStyle === 'intaglio') {
      return {
        borderWidth: undefined,
        borderStyle: undefined,
        borderColor: undefined,
        boxShadow: `inset 0 0 0 ${rule} ${borderColor}, inset 0 0 0 calc(${rule} * 2) transparent, inset 0 0 0 calc(${rule} * 3) ${borderColor}`,
        outline: undefined,
        outlineOffset: undefined,
        matte,
        mat,
      }
    }
    
    // For standard CSS border styles, use border with padding.
    // Longhand rather than the `border` shorthand: the width is a clamp(), and
    // the shorthand is the fragile place to put a function.
    return {
      borderWidth: rule,
      borderStyle,
      borderColor,
      boxShadow: undefined,
      outline: undefined,
      outlineOffset: undefined,
      matte,
      mat,
    }
  }

  const borderStyle = getPageBorderStyle()
  const hasBorder = config?.pageBorder?.enabled

  /**
   * The page's rhythm, published here as well as inside `AppearanceProvider`.
   *
   * The provider renders inside `InviteRenderer`, and the SSR hero renders
   * above it, so anything server-rendered read the token's fallback instead of
   * this page's actual density - a `tight` page sized its poster as if it were
   * `normal`. The provider still republishes it for the tiles below; this is
   * only what the hero can see.
   */
  const pageRhythm = resolveAppearance(config).spaceSection

  return (
    <OpeningLayer
      key={`opening:${opening ?? 'none'}:${slug}`}
      id={opening}
      slug={slug}
      coverColor={coverColor}
    >
      {hasBorder ? (
        // Container with border and padding
        <div 
          className="relative w-full min-h-screen"
          style={{
            backgroundColor: '#f5f5f5', // Light gray background to show border
            padding: borderStyle.matte,
          } as React.CSSProperties}
        >
          <div 
            className="relative w-full"
            style={{
              overflowX: 'clip',
              background: pageBackground,
              minHeight: '100vh', 
              height: 'auto',
              // The mat. An absolutely positioned `inset: 0` child resolves
              // against the padding box, so the frame below still draws at this
              // container's outer edge while the tiles sit in from it.
              padding: borderStyle.mat,
              // Published so a tile can subtract it from the screen it has to
              // fit into. Unbordered pages never set it and the poster's own
              // `0px` fallback is the right answer there.
              '--page-mat': borderStyle.mat,
              '--space-section': pageRhythm,
            } as React.CSSProperties}
          >
            {/* The frame draws above the tiles, not behind them.
                It used to live on this container as an `inset` box-shadow, and
                an inset shadow paints under its own element's content - so the
                first tile, a full-width poster, covered the band on the top,
                left and right and the page looked unframed at the fold. A
                border is the edge of the page; nothing the page contains is
                in front of it. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                zIndex: 10,
                borderWidth: borderStyle.borderWidth,
                borderStyle: borderStyle.borderStyle,
                borderColor: borderStyle.borderColor,
                boxShadow: borderStyle.boxShadow,
                outline: borderStyle.outline,
                outlineOffset: borderStyle.outlineOffset,
              } as React.CSSProperties}
            />
            {/* Texture overlay at page level */}
            <TextureOverlay
              type={config.texture?.type || 'none'}
              intensity={config.texture?.intensity || 40}
              imageUrl={config.texture?.imageUrl}
              textureBlend={config.texture?.textureBlend}
            />

            {/* Every tile renders in the host's order; the poster's server
                markup goes into its own slot rather than above the list. */}
            <InviteRenderer
              config={configForClient}
              ssrTiles={ssrTiles}
              eventSlug={slug}
              eventDate={event?.date}
              eventTimezone={event?.timezone}
              hasRsvp={event?.has_rsvp}
              hasRegistry={event?.has_registry}
              catalogShowOnEventPage={event?.catalog_show_on_event_page}
              catalogTitle={event?.catalog_title}
              catalogPurpose={event?.catalog_purpose}
              skipTextureOverlay={true}
              skipBackgroundColor={true}
              allowedSubEvents={subEvents}
              guestToken={guestToken}
              rsvpCount={event?.rsvp_count}
            />
            {/* Branding component at the bottom */}
            {(event?.show_branding ?? true) && <PoweredByBranding config={config} />}
          </div>
        </div>
      ) : (
        // No border - original structure
        <div
          className="w-full relative"
          style={{
            overflowX: 'clip',
            background: pageBackground,
            minHeight: 'auto',
            height: 'auto',
            '--space-section': pageRhythm,
          } as React.CSSProperties}
        >
          {/* Texture overlay at page level */}
          <TextureOverlay
            type={config.texture?.type || 'none'}
            intensity={config.texture?.intensity || 40}
            imageUrl={config.texture?.imageUrl}
            textureBlend={config.texture?.textureBlend}
          />

          {/* Every tile renders in the host's order; the poster's server
              markup goes into its own slot rather than above the list. */}
          <InviteRenderer
            config={configForClient}
            ssrTiles={ssrTiles}
            eventSlug={slug}
            eventDate={event?.date}
            eventTimezone={event?.timezone}
            hasRsvp={event?.has_rsvp}
            hasRegistry={event?.has_registry}
            catalogShowOnEventPage={event?.catalog_show_on_event_page}
            catalogTitle={event?.catalog_title}
            catalogPurpose={event?.catalog_purpose}
            skipTextureOverlay={true}
            skipBackgroundColor={true}
            allowedSubEvents={subEvents}
            guestToken={guestToken}
            rsvpCount={event?.rsvp_count}
          />
          {/* Branding component at the bottom */}
          {(event?.show_branding ?? true) && <PoweredByBranding config={config} />}
        </div>
      )}
      <ExperienceLayer id={experience} slug={slug} />
    </OpeningLayer>
  )
}

