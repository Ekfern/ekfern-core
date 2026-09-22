'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { InviteConfig, Tile, TileType } from '@/lib/invite/schema'
import { buildDefaultTileSettingsRecord } from '@/lib/invite/pageLayoutTileDefaults'
import { colorInputValue } from '@/lib/invite/colorInputValue'
import { resolveAppearance } from '@/lib/invite/appearance'
import { Input } from '@/components/ui/input'
import TileList from '@/components/invite/tiles/TileList'
import { AppearanceProvider } from '@/components/invite/render/AppearanceProvider'
import TileSettingsList from '@/components/invite/tiles/TileSettingsList'
import { useConfigHistory } from '@/lib/invite/useConfigHistory'
import PageBackgroundSettings from '@/components/invite/PageBackgroundSettings'
import LookAndStyleSettings from '@/components/invite/LookAndStyleSettings'
import InviteAnimationSettings from '@/components/invite/InviteAnimationSettings'
import {
  InviteMobileAnimationShell,
  PlayOpeningButton,
  useInvitePreviewAnimationState,
} from '@/components/invite/InviteMobileAnimationPreview'

export interface DummyEventLike {
  title: string
  date?: string
  city?: string
  slug: string
  has_rsvp: boolean
  has_registry: boolean
}

interface PageLayoutStudioCanvasProps {
  config: InviteConfig
  setConfig: React.Dispatch<React.SetStateAction<InviteConfig>>
  eventLike: DummyEventLike
  /** Pass 0 for page layout studio (no real event); image upload may not work */
  eventIdForTiles: number
  /** Changes when a different layout is loaded, so background pickers re-read it. */
  syncKey?: string | number
}

export default function PageLayoutStudioCanvas({
  config,
  setConfig,
  eventLike,
  eventIdForTiles,
  syncKey,
}: PageLayoutStudioCanvasProps) {
  const { pushHistory } = useConfigHistory(config, setConfig)
  const [previewOrder, setPreviewOrder] = useState<Map<string, number>>(new Map())
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)
  const [allTilesExpanded, setAllTilesExpanded] = useState(false)

  useEffect(() => {
    if (config.tiles?.length) {
      const m = new Map<string, number>()
      config.tiles.forEach((t, i) => m.set(t.id, t.order ?? i))
      setPreviewOrder(m)
      setSelectedTileId((prev) => {
        const first = config.tiles!.find((t) => t.enabled)
        return prev ?? first?.id ?? null
      })
    }
  }, [config.tiles])

  const sortedTiles: Tile[] = config.tiles?.length
    ? [...config.tiles].sort((a, b) => {
        const orderA = previewOrder.get(a.id) ?? a.previewOrder ?? a.order ?? 0
        const orderB = previewOrder.get(b.id) ?? b.previewOrder ?? b.order ?? 0
        return orderA - orderB
      })
    : []

  const handleTileReorder = (tiles: Tile[]) => {
    pushHistory()
    const newOrder = new Map<string, number>()
    tiles.forEach((t, i) => newOrder.set(t.id, i))
    setPreviewOrder(newOrder)
    setConfig((prev) => ({
      ...prev,
      tiles: tiles.map((t, i) => ({ ...t, order: i })),
    }))
  }

  const handleTileUpdate = (tile: Tile) => {
    pushHistory()
    setConfig((prev) => ({
      ...prev,
      tiles: (prev.tiles || []).map((t) => (t.id === tile.id ? tile : t)),
    }))
  }

  const handleTileToggle = (tileId: string, enabled: boolean) => {
    pushHistory()
    setConfig((prev) => ({
      ...prev,
      tiles: (prev.tiles || []).map((t) => (t.id === tileId ? { ...t, enabled } : t)),
    }))
  }

  const handleOverlayToggle = (tileId: string, targetTileId: string | undefined) => {
    pushHistory()
    setConfig((prev) => ({
      ...prev,
      tiles: (prev.tiles || []).map((t) =>
        t.id === tileId ? { ...t, overlayTargetId: targetTileId } : t
      ),
    }))
  }

  const handleAddTile = useCallback(
    (type: TileType) => {
      pushHistory()
      const defaultSettings = buildDefaultTileSettingsRecord({
        title: eventLike.title,
        date: eventLike.date,
        city: eventLike.city,
      })
      setConfig((prev) => {
        // The footer is always last, so it is not counted when working out where
        // a new tile goes. Counting it puts every later tile after the footer -
        // and a layout authored that way carries the problem to every host who
        // applies it.
        const positions = (prev.tiles ?? [])
          .filter((t) => t.type !== 'footer')
          .map((t) => t.order ?? 0)
        const newTile: Tile = {
          id: `tile-${type}-${Date.now().toString(36)}`,
          type,
          enabled: true,
          order: positions.length > 0 ? Math.max(...positions) + 1 : 0,
          settings: defaultSettings[type],
        }
        return { ...prev, tiles: [...(prev.tiles ?? []), newTile] }
      })
    },
    [eventLike.city, eventLike.date, eventLike.title, setConfig, pushHistory]
  )

  const handleRemoveTile = useCallback(
    (tileId: string) => {
      pushHistory()
      setConfig((prev) => ({
        ...prev,
        tiles: (prev.tiles ?? [])
          .filter((t) => t.id !== tileId)
          .map((t) =>
            t.type === 'title' && t.overlayTargetId === tileId
              ? { ...t, overlayTargetId: undefined }
              : t
          ),
      }))
      setSelectedTileId((prev) => (prev === tileId ? null : prev))
    },
    [setConfig, pushHistory]
  )

  const displayBackgroundColor =
    config.customColors?.backgroundColor ?? resolveAppearance(config).backgroundColor
  const previewAnim = useInvitePreviewAnimationState(config, 'layout-studio-preview')
  const mobilePreviewSectionRef = React.useRef<HTMLDivElement>(null)

  const playOpeningInPreview = useCallback(() => {
    previewAnim.replayOpening()
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      mobilePreviewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [previewAnim.replayOpening])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 w-full items-start">
      <div className="lg:col-span-3 space-y-4 w-full min-w-0 pt-4 sm:pt-6">
        <div className="bg-white rounded-lg border-2 border-eco-green-light p-3 sm:p-4 w-full overflow-x-hidden">
          <h2 className="text-lg font-semibold text-eco-green mb-4">Page Settings</h2>
          <div className="space-y-4">
            <PageBackgroundSettings
              config={config}
              setConfig={setConfig}
              syncKey={syncKey}
              defaultOpen
            />


            <InviteAnimationSettings
              config={config}
              setConfig={setConfig}
              idPrefix="layout"
              description="Saved on the template and applied when hosts use this design (hosts can still override on their event)."
              onPlay={playOpeningInPreview}
              canPlay={!!previewAnim.openingId}
            />

            <LookAndStyleSettings config={config} setConfig={setConfig}>
              {/* Staff-only: layouts carry frame art and corner decorations
                  that hosts deliberately do not get to change. */}
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <label className="block text-sm font-medium mb-2">Frame image (optional)</label>
                    <Input
                      type="url"
                      value={config.pageFrame?.imageUrl || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          pageFrame: e.target.value.trim() ? { imageUrl: e.target.value.trim() } : undefined,
                        }))
                      }
                      placeholder="https://… (SVG or PNG with transparency)"
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">Full-page frame overlay (e.g. ornate border). Leave empty for none.</p>
                  </div>
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <label className="block text-sm font-medium mb-2">Corner decorations (optional)</label>
                    <p className="text-xs text-gray-500 mb-2">Image URLs for corner flourishes.</p>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="text-xs text-gray-600">Top left</label>
                        <Input type="url" value={config.cornerDecorations?.topLeft || ''} onChange={(e) => setConfig((prev) => ({ ...prev, cornerDecorations: { ...prev.cornerDecorations, topLeft: e.target.value.trim() || undefined } }))} placeholder="https://…" className="w-full mt-0.5" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Top right</label>
                        <Input type="url" value={config.cornerDecorations?.topRight || ''} onChange={(e) => setConfig((prev) => ({ ...prev, cornerDecorations: { ...prev.cornerDecorations, topRight: e.target.value.trim() || undefined } }))} placeholder="https://…" className="w-full mt-0.5" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Bottom left</label>
                        <Input type="url" value={config.cornerDecorations?.bottomLeft || ''} onChange={(e) => setConfig((prev) => ({ ...prev, cornerDecorations: { ...prev.cornerDecorations, bottomLeft: e.target.value.trim() || undefined } }))} placeholder="https://…" className="w-full mt-0.5" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Bottom right</label>
                        <Input type="url" value={config.cornerDecorations?.bottomRight || ''} onChange={(e) => setConfig((prev) => ({ ...prev, cornerDecorations: { ...prev.cornerDecorations, bottomRight: e.target.value.trim() || undefined } }))} placeholder="https://…" className="w-full mt-0.5" />
                      </div>
                    </div>
                  </div>
            </LookAndStyleSettings>
          </div>
        </div>

        <div className="bg-white rounded-lg border-2 border-eco-green-light p-3 sm:p-4 w-full overflow-x-hidden">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-eco-green">
              Tile Settings
              {sortedTiles.length > 0 && (
                <span className="text-xs text-gray-500 font-normal ml-2">
                  ({sortedTiles.length} {sortedTiles.length === 1 ? 'tile' : 'tiles'})
                </span>
              )}
            </h2>
            <button
              onClick={() => setAllTilesExpanded(!allTilesExpanded)}
              className="text-xs text-eco-green hover:underline px-2 py-1 rounded hover:bg-eco-green-light transition-colors"
              type="button"
            >
              {allTilesExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          </div>
          {sortedTiles.length > 0 ? (
            <TileSettingsList
              tiles={sortedTiles}
              onReorder={handleTileReorder}
              onUpdate={handleTileUpdate}
              onToggle={handleTileToggle}
              onOverlayToggle={handleOverlayToggle}
              onAddTile={handleAddTile}
              onRemoveTile={handleRemoveTile}
              eventId={eventIdForTiles}
              hasRsvp={eventLike.has_rsvp}
              hasRegistry={eventLike.has_registry}
              forceExpanded={allTilesExpanded}
              templateStudio
            />
          ) : (
            <div className="space-y-3">
              <p className="text-gray-500 text-sm">No tiles yet — add one below.</p>
              <TileSettingsList
                tiles={[]}
                onReorder={() => {}}
                onUpdate={() => {}}
                onToggle={() => {}}
                onAddTile={handleAddTile}
                eventId={eventIdForTiles}
                hasRsvp={eventLike.has_rsvp}
                hasRegistry={eventLike.has_registry}
                forceExpanded={allTilesExpanded}
                templateStudio
              />
            </div>
          )}
        </div>
      </div>

      <div ref={mobilePreviewSectionRef} className="lg:col-span-2 w-full min-w-0 overflow-x-hidden">
        <div className="bg-white rounded-lg border-2 border-eco-green-light p-3 sm:p-4 w-full overflow-x-hidden">
          <h2 className="text-base sm:text-lg font-semibold text-eco-green mb-2">
            Mobile Preview
            {sortedTiles.length > 0 && (
              <span className="text-xs text-gray-500 font-normal ml-2">
                ({sortedTiles.filter((t) => t.enabled).length} of {sortedTiles.length} enabled)
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-600 mb-3 sm:mb-4">
            Drag tiles to reorder. Sample event data is used for preview. Selected animations play in this phone.
          </p>
          <PlayOpeningButton
            visible={!!previewAnim.openingId}
            onPlay={playOpeningInPreview}
            variant="abovePreview"
            className="lg:hidden"
          />
          <div className="flex justify-center items-start w-full overflow-x-hidden">
            <div className="relative w-full flex justify-center" style={{ maxWidth: '100%' }}>
              <div
                className="bg-black shadow-2xl mx-auto"
                style={{
                  maxWidth: 'calc(100% - 16px)',
                  width: 'min(100%, 320px, 390px)',
                  borderRadius: 'clamp(1.5rem, 4vw, 3rem)',
                  padding: 'clamp(3px, 1vw, 6px)',
                }}
              >
                <div
                  className="bg-black relative"
                  style={{
                    borderRadius: 'clamp(1.25rem, 3.5vw, 2.75rem)',
                    padding: 'clamp(1px, 0.5vw, 3px)',
                  }}
                >
                  <div
                    className="absolute left-1/2 transform -translate-x-1/2 bg-black rounded-full z-20"
                    style={{
                      top: 'clamp(6px, 1.5vw, 12px)',
                      width: 'clamp(80px, 25vw, 126px)',
                      height: 'clamp(24px, 7.5vw, 37px)',
                    }}
                  />
                  <InviteMobileAnimationShell
                    openingId={previewAnim.openingId}
                    experienceId={previewAnim.experienceId}
                    slug={previewAnim.slug}
                    layerKey={previewAnim.layerKey}
                    coverColor={displayBackgroundColor}
                    className="relative overflow-hidden bg-white flex flex-col w-full"
                    style={{
                      width: '100%',
                      aspectRatio: '1179 / 2556',
                      backgroundColor: displayBackgroundColor,
                      borderRadius: 'clamp(1.25rem, 3vw, 2.5rem)',
                    }}
                  >
                    <div
                      className="bg-transparent flex items-start justify-center flex-shrink-0"
                      style={{
                        height: 'clamp(30px, 8vw, 47px)',
                        paddingTop: 'clamp(4px, 1vw, 8px)',
                      }}
                    >
                      <div
                        className="bg-black rounded-full opacity-30"
                        style={{
                          width: 'clamp(80px, 25vw, 126px)',
                          height: 'clamp(24px, 7.5vw, 37px)',
                        }}
                      />
                    </div>
                    <div
                      className="overflow-y-auto flex-1 w-full overflow-x-hidden"
                      style={{ paddingBottom: '24px' }}
                    >
                      {/* The canvas has to publish the layout's own colours and
                          fonts. Without this the tiles below fall through to
                          their hardcoded fallbacks, so a layout was authored
                          against #1F2937 on Georgia and only revealed its real
                          palette on the preview screen. */}
                      {sortedTiles.length > 0 ? (
                        <AppearanceProvider config={config}>
                        <TileList
                          tiles={sortedTiles}
                          onReorder={handleTileReorder}
                          eventDate={eventLike.date}
                          eventSlug={eventLike.slug}
                          eventTitle={
                            (sortedTiles.find((t) => t.type === 'title')?.settings as { text?: string })?.text ||
                            eventLike.title
                          }
                          hasRsvp={eventLike.has_rsvp}
                          hasRegistry={eventLike.has_registry}
                          allowedSubEvents={[]}
                        />
                        </AppearanceProvider>
                      ) : (
                        <div className="p-8 text-center text-gray-500">
                          <p>No tiles</p>
                        </div>
                      )}
                    </div>
                    <div
                      className="absolute left-1/2 transform -translate-x-1/2 bg-gray-800 rounded-full z-10"
                      style={{
                        bottom: 'clamp(4px, 1vw, 8px)',
                        width: 'clamp(90px, 28vw, 134px)',
                        height: 'clamp(3px, 0.8vw, 5px)',
                      }}
                    />
                  </InviteMobileAnimationShell>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
