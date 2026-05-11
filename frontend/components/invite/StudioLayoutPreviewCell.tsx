'use client'

import React, { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import PageLayoutCardPreview from '@/components/invite/PageLayoutCardPreview'
import type { InvitePageLayoutResponse } from '@/lib/invite/api'
import { normalizeMediaUrlForNextImage } from '@/lib/image-utils'

class PreviewErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

function LazyPreviewWrapper({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true)
      },
      { rootMargin: '120px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className="h-full w-full">
      {inView ? children : fallback}
    </div>
  )
}

function ThumbnailImg({
  layout,
  onError,
  className,
}: {
  layout: InvitePageLayoutResponse
  onError: () => void
  className?: string
}) {
  if (!layout.thumbnail?.trim()) return null
  return (
    <img
      src={normalizeMediaUrlForNextImage(layout.thumbnail)}
      alt={layout.preview_alt || layout.name}
      loading="lazy"
      decoding="async"
      className={className ?? 'h-full w-full object-cover object-top'}
      onError={onError}
    />
  )
}

const PLACEHOLDER = (
  <div className="flex h-full w-full items-center justify-center bg-gray-100 text-[10px] text-gray-400">—</div>
)

/**
 * Table cell: prefers a live invite render from layout.config (tile-based layouts)
 * so reviewers can distinguish recipes; falls back to the stored thumbnail URL.
 */
export default function StudioLayoutPreviewCell({
  layout,
}: {
  layout: InvitePageLayoutResponse
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const [liveFailed, setLiveFailed] = useState(false)

  const hasTiles = Boolean(layout.config?.tiles && layout.config.tiles.length > 0)
  const useLive = hasTiles && !liveFailed

  const thumbnailEl = (
    <ThumbnailImg
      layout={layout}
      className="h-full w-full object-cover object-top"
      onError={() => setImageFailed(true)}
    />
  )

  if (useLive) {
    return (
      <div className="relative w-[5.75rem] shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50 aspect-[9/16]">
        <LazyPreviewWrapper
          fallback={
            imageFailed || !layout.thumbnail?.trim() ? (
              <div className="flex h-full animate-pulse items-center justify-center text-[10px] text-gray-400">
                …
              </div>
            ) : (
              thumbnailEl
            )
          }
        >
          <PreviewErrorBoundary
            fallback={
              !imageFailed && layout.thumbnail?.trim() ? thumbnailEl : PLACEHOLDER
            }
            onError={() => setLiveFailed(true)}
          >
            <PageLayoutCardPreview config={layout.config} className="h-full w-full" />
          </PreviewErrorBoundary>
        </LazyPreviewWrapper>
      </div>
    )
  }

  if (imageFailed || !layout.thumbnail?.trim()) {
    return (
      <div className="relative flex aspect-[9/16] w-[5.75rem] shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-100 px-1 text-center text-[10px] leading-tight text-gray-400">
        Preview unavailable
      </div>
    )
  }

  return (
    <div className="relative aspect-[9/16] w-[5.75rem] shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-100">
      {thumbnailEl}
    </div>
  )
}
