'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, Tag, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type TextOverlay } from '@/lib/invite/api'
import DesignCatalogGrid, { useDesignCatalog } from '@/components/invite/DesignCatalogGrid'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (src: string, textOverlays: TextOverlay[]) => void
}

export default function DesignMediaPicker({ open, onClose, onSelect }: Props) {
  const [activeTag, setActiveTag] = useState<string>('')
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Paginated + server-searched catalog; only fetches while the modal is open.
  const catalog = useDesignCatalog({ enabled: open, q: searchQuery, tag: activeTag })

  useEffect(() => {
    if (!open) return
    setSearchQuery('')
    setActiveTag('')
  }, [open])

  // Close dropdown on outside click
  useEffect(() => {
    if (!tagDropdownOpen) return
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [tagDropdownOpen])

  // Tag suggestions are derived from whatever pages have loaded so far; they
  // grow as the host loads more. Selecting one filters server-side.
  const allTags = useMemo(
    () => Array.from(new Set(catalog.items.flatMap((c) => c.tags))).sort(),
    [catalog.items]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="text-lg font-semibold">Design Media Library</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl font-bold leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Search + Tag dropdown row */}
        <div className="px-5 py-3 border-b shrink-0">
          <div className="flex gap-2 items-center">
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or tags…"
                className="pl-9"
                aria-label="Search design backgrounds"
              />
            </div>

            {/* Tags dropdown */}
            <div className="relative shrink-0" ref={dropdownRef}>
              <button
                onClick={() => setTagDropdownOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                  activeTag
                    ? 'bg-eco-green text-white border-eco-green'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
                aria-expanded={tagDropdownOpen}
                aria-haspopup="listbox"
              >
                <Tag className="h-3.5 w-3.5" />
                Tags
                {activeTag && (
                  <span className="bg-white/25 text-white text-xs rounded-full px-1.5 py-0.5 leading-none font-semibold">
                    1
                  </span>
                )}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${tagDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {tagDropdownOpen && allTags.length > 0 && (
                <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded-lg shadow-lg w-56">
                  <ul
                    role="listbox"
                    className="max-h-64 overflow-y-auto py-1"
                  >
                    {allTags.map((tag) => {
                      const checked = activeTag === tag
                      return (
                        <li key={tag}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTag(checked ? '' : tag)
                              setTagDropdownOpen(false)
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm capitalize cursor-pointer hover:bg-gray-50 text-left"
                          >
                            <span className={`h-3.5 w-3.5 rounded-full border ${checked ? 'bg-eco-green border-eco-green' : 'border-gray-300'}`} />
                            <span className={checked ? 'font-medium text-gray-900' : 'text-gray-600'}>
                              {tag}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>

                  {activeTag && (
                    <div className="border-t px-3 py-2">
                      <button
                        onClick={() => { setActiveTag(''); setTagDropdownOpen(false) }}
                        className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        Clear tag
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Active tag chip */}
          {activeTag && (
            <div className="flex items-center mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-eco-green/10 text-eco-green capitalize border border-eco-green/30">
                {activeTag}
                <button
                  onClick={() => setActiveTag('')}
                  aria-label={`Remove ${activeTag} filter`}
                  className="hover:text-eco-green/70"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="overflow-y-auto flex-1 p-5">
          <DesignCatalogGrid
            items={catalog.items}
            loading={catalog.loading}
            loadingMore={catalog.loadingMore}
            error={catalog.error}
            hasNext={catalog.hasNext}
            onSelect={(sample) => {
              // Editor always receives the full background image, not the thumbnail.
              onSelect(sample.background_image_url, sample.text_overlays)
              onClose()
            }}
            onLoadMore={catalog.loadMore}
            onRetry={catalog.reload}
            gridClassName="grid grid-cols-2 sm:grid-cols-3 gap-4"
            skeletonCount={6}
            emptyMessage={
              searchQuery.trim() || activeTag
                ? 'No cards match this search or tag. Try other words or clear filters.'
                : 'No designs found.'
            }
            renderMeta={(sample) => sample.tags.length > 0 ? (
              <p className="text-xs text-gray-500 truncate capitalize mt-0.5">{sample.tags.join(', ')}</p>
            ) : null}
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t shrink-0 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
