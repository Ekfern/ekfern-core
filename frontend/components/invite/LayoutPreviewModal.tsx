'use client'

import React from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { InvitePageLayout } from '@/lib/invite/pageLayouts'
import { resolveAppearance } from '@/lib/invite/appearance'
import LivingPosterPage from '@/components/invite/living-poster/LivingPosterPage'
import TextureOverlay from '@/components/invite/living-poster/TextureOverlay'
import {
  PREVIEW_SAMPLE,
  enrichConfigWithSampleData,
  skeletonizeDesignTiles,
} from '@/components/invite/PageLayoutCardPreview'

export interface LayoutPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  layout: InvitePageLayout | null
  onSelect?: (layoutId: string) => void
  isSelected?: boolean
}

/**
 * Full-screen "sneak peek" of a page layout, opened from the Layout gallery
 * before the host commits with Select. Renders the actual tile stack at real
 * size (not the scaled-down gallery card) so hosts can judge it properly.
 */
export default function LayoutPreviewModal({
  isOpen,
  onClose,
  layout,
  onSelect,
  isSelected = false,
}: LayoutPreviewModalProps): React.ReactElement | null {
  if (!isOpen || !layout) return null

  const config = layout.config
  const appearance = resolveAppearance(config)
  const pageBackground = appearance.backgroundGradient || appearance.backgroundColor
  const previewConfig = skeletonizeDesignTiles(enrichConfigWithSampleData(config))

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Full-screen preview of ${layout.name}`}
    >
      <div
        className="relative w-full max-w-sm h-full max-h-[calc(100vh-4rem)] rounded-2xl overflow-hidden shadow-2xl flex flex-col bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0 z-10">
          <span className="text-sm font-semibold text-gray-900 truncate">{layout.name}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="text-gray-500 hover:text-gray-800 shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative flex-1 overflow-y-auto">
          <div className="relative" style={{ background: pageBackground }}>
            <TextureOverlay
              type={config?.texture?.type || 'none'}
              intensity={config?.texture?.intensity ?? 40}
              imageUrl={config?.texture?.imageUrl}
              textureBlend={config?.texture?.textureBlend}
            />
            <LivingPosterPage
              config={previewConfig}
              eventSlug="preview"
              eventDate={PREVIEW_SAMPLE.dateDisplay}
              hasRsvp={true}
              hasRegistry={true}
              skipBackgroundColor={true}
              skipTextureOverlay={true}
              allowedSubEvents={[]}
            />
          </div>
        </div>

        {onSelect && (
          <div className="px-4 py-3 bg-white border-t border-gray-200 shrink-0">
            <Button
              type="button"
              className="w-full font-medium"
              onClick={() => onSelect(layout.id)}
            >
              {isSelected ? '✓ Selected' : 'Select this layout'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
