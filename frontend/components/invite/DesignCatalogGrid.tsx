'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { getDesignSamplesPage, type DesignSample } from '@/lib/invite/api'

// ---------------------------------------------------------------------------
// useDesignCatalog — paginated, server-searched catalog data source.
//
// Designed for grids that may hold hundreds of items: it pages the API
// (default 24/page), debounces the search query, resets to page 1 when the
// query/tag changes, and accumulates results as the caller loads more.
// ---------------------------------------------------------------------------

interface UseDesignCatalogOptions {
  /** Only fetch while enabled (e.g. modal open / tab active). */
  enabled?: boolean
  /** Raw search text; debounced internally before hitting the server. */
  q?: string
  /** Optional single tag filter (server-side icontains). */
  tag?: string
  pageSize?: number
}

interface UseDesignCatalogResult {
  items: DesignSample[]
  loading: boolean
  loadingMore: boolean
  error: boolean
  hasNext: boolean
  count: number
  loadMore: () => void
  reload: () => void
}

const DEBOUNCE_MS = 300

export function useDesignCatalog({
  enabled = true,
  q = '',
  tag = '',
  pageSize = 24,
}: UseDesignCatalogOptions): UseDesignCatalogResult {
  const [items, setItems] = useState<DesignSample[]>([])
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)

  const [debouncedQ, setDebouncedQ] = useState(q)
  // Bumping this forces a re-fetch of page 1 (used by reload()).
  const [reloadToken, setReloadToken] = useState(0)
  // Guards against out-of-order responses overwriting newer state.
  const requestIdRef = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [q])

  // Fetch first page whenever the effective query/tag/enable changes.
  useEffect(() => {
    if (!enabled) return
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(false)
    getDesignSamplesPage({ page: 1, pageSize, q: debouncedQ, tags: tag })
      .then((res) => {
        if (requestId !== requestIdRef.current) return
        setItems(res.results)
        setCount(res.count)
        setHasNext(res.hasNext)
        setPage(1)
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return
        setError(true)
        setItems([])
        setHasNext(false)
        setCount(0)
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return
        setLoading(false)
      })
  }, [enabled, debouncedQ, tag, pageSize, reloadToken])

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasNext) return
    const nextPage = page + 1
    const requestId = requestIdRef.current
    setLoadingMore(true)
    getDesignSamplesPage({ page: nextPage, pageSize, q: debouncedQ, tags: tag })
      .then((res) => {
        // Ignore if a fresh page-1 fetch started after we requested this page.
        if (requestId !== requestIdRef.current) return
        setItems((prev) => [...prev, ...res.results])
        setHasNext(res.hasNext)
        setPage(nextPage)
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return
        setError(true)
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return
        setLoadingMore(false)
      })
  }, [loading, loadingMore, hasNext, page, pageSize, debouncedQ, tag])

  const reload = useCallback(() => setReloadToken((t) => t + 1), [])

  return { items, loading, loadingMore, error, hasNext, count, loadMore, reload }
}

// ---------------------------------------------------------------------------
// LazyThumb — a single catalog tile image with skeleton + error/retry.
// Renders a fixed-aspect placeholder so the grid has no layout shift.
// ---------------------------------------------------------------------------

interface LazyThumbProps {
  src: string
  alt: string
  eager?: boolean
}

export function LazyThumb({ src, alt, eager = false }: LazyThumbProps): React.ReactElement {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  // Cache-busting token lets a manual retry re-request a failed image.
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    setStatus('loading')
  }, [src])

  const finalSrc = retryToken === 0 ? src : `${src}${src.includes('?') ? '&' : '?'}r=${retryToken}`

  return (
    <div className="absolute inset-0">
      {status !== 'loaded' && (
        <div
          className={[
            'absolute inset-0 bg-gray-100',
            status === 'loading' ? 'animate-pulse' : '',
          ].join(' ')}
          aria-hidden
        />
      )}
      {status === 'error' ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setStatus('loading')
            setRetryToken((t) => t + 1)
          }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-gray-400 text-xs hover:text-gray-600"
          aria-label="Retry loading image"
        >
          <span className="text-lg leading-none">↻</span>
          Retry
        </button>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={finalSrc}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={[
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-200',
            status === 'loaded' ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        />
      )}
    </div>
  )
}

/** Prefer the small thumbnail derivative; fall back to the full background. */
export function thumbSrc(sample: DesignSample): string {
  return sample.thumbnail_url || sample.background_image_url
}

// ---------------------------------------------------------------------------
// DesignCatalogGrid — presentational grid with skeletons + load-more.
// ---------------------------------------------------------------------------

interface DesignCatalogGridProps {
  items: DesignSample[]
  loading: boolean
  loadingMore: boolean
  error: boolean
  hasNext: boolean
  onSelect: (sample: DesignSample) => void
  onLoadMore: () => void
  onRetry?: () => void
  /** How many leading tiles to eager-load (first visible row). */
  eagerCount?: number
  /** Tailwind grid column classes. */
  gridClassName?: string
  /** Number of skeleton tiles to render while the first page loads. */
  skeletonCount?: number
  emptyMessage?: string
  /** Optional extra content rendered inside each tile's footer. */
  renderMeta?: (sample: DesignSample) => React.ReactNode
}

export default function DesignCatalogGrid({
  items,
  loading,
  loadingMore,
  error,
  hasNext,
  onSelect,
  onLoadMore,
  onRetry,
  eagerCount = 5,
  gridClassName = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3',
  skeletonCount = 10,
  emptyMessage = 'No backgrounds match your search.',
  renderMeta,
}: DesignCatalogGridProps): React.ReactElement {
  // Initial load: show skeleton tiles (no layout shift, no spinner-only screen).
  if (loading && items.length === 0) {
    return (
      <div className={gridClassName} aria-busy="true" aria-label="Loading backgrounds">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="rounded-lg overflow-hidden border border-gray-200">
            <div className="w-full bg-gray-100 animate-pulse" style={{ aspectRatio: '9 / 16' }} />
            <div className="p-2 bg-white">
              <div className="h-3 w-2/3 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <p className="text-sm text-gray-500">Couldn&apos;t load backgrounds.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-sm text-blue-600 underline hover:text-blue-800"
          >
            Try again
          </button>
        )}
      </div>
    )
  }

  if (!loading && items.length === 0) {
    return <div className="text-sm text-gray-500 py-6 text-center">{emptyMessage}</div>
  }

  return (
    <div className="space-y-4">
      <div className={gridClassName}>
        {items.map((sample, i) => (
          <button
            key={sample.id}
            type="button"
            className="group rounded-lg overflow-hidden border-2 border-gray-200 hover:border-eco-green text-left transition-colors"
            onClick={() => onSelect(sample)}
            aria-label={`Select ${sample.name}`}
          >
            <div className="relative w-full bg-gray-100 overflow-hidden" style={{ aspectRatio: '9 / 16' }}>
              <LazyThumb src={thumbSrc(sample)} alt={sample.name} eager={i < eagerCount} />
            </div>
            <div className="p-2 bg-white">
              <p className="text-xs font-medium text-gray-800 truncate">{sample.name}</p>
              {renderMeta?.(sample)}
            </div>
          </button>
        ))}
      </div>

      {hasNext && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
