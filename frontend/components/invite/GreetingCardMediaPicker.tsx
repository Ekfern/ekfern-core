'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, Tag, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fuzzyFilter } from '@/lib/fuzzyFilter'
import { getGreetingCardSamples, type GreetingCardSample, type TextOverlay } from '@/lib/invite/api'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (src: string, textOverlays: TextOverlay[]) => void
}

export default function GreetingCardMediaPicker({ open, onClose, onSelect }: Props) {
  const [cards, setCards] = useState<GreetingCardSample[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setSearchQuery('')
    setActiveTags([])
    setLoading(true)
    getGreetingCardSamples()
      .then(setCards)
      .finally(() => setLoading(false))
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

  const allTags = useMemo(
    () => Array.from(new Set(cards.flatMap((c) => c.tags))).sort(),
    [cards]
  )

  // OR logic: card matches if it has any of the selected tags
  const tagFiltered = useMemo(
    () =>
      activeTags.length === 0
        ? cards
        : cards.filter((c) => activeTags.some((t) => c.tags.includes(t))),
    [cards, activeTags]
  )

  const filtered = useMemo(
    () => fuzzyFilter(tagFiltered, searchQuery, ['name', 'description', 'tags']),
    [tagFiltered, searchQuery]
  )

  function toggleTag(tag: string) {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  if (!open) return null

  const isFiltering = activeTags.length > 0 || searchQuery.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="text-lg font-semibold">Greeting Card Media Library</h2>
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
            {/* Fuzzy search input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, tags… (typos OK)"
                className="pl-9"
                aria-label="Search greeting card backgrounds"
              />
            </div>

            {/* Tags dropdown */}
            <div className="relative shrink-0" ref={dropdownRef}>
              <button
                onClick={() => setTagDropdownOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                  activeTags.length > 0
                    ? 'bg-eco-green text-white border-eco-green'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
                aria-expanded={tagDropdownOpen}
                aria-haspopup="listbox"
              >
                <Tag className="h-3.5 w-3.5" />
                Tags
                {activeTags.length > 0 && (
                  <span className="bg-white/25 text-white text-xs rounded-full px-1.5 py-0.5 leading-none font-semibold">
                    {activeTags.length}
                  </span>
                )}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${tagDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {tagDropdownOpen && allTags.length > 0 && (
                <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded-lg shadow-lg w-56">
                  <ul
                    role="listbox"
                    aria-multiselectable="true"
                    className="max-h-64 overflow-y-auto py-1"
                  >
                    {allTags.map((tag) => {
                      const checked = activeTags.includes(tag)
                      return (
                        <li key={tag}>
                          <label className="flex items-center gap-2.5 px-3 py-1.5 text-sm capitalize cursor-pointer hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTag(tag)}
                              className="h-3.5 w-3.5 rounded accent-eco-green"
                            />
                            <span className={checked ? 'font-medium text-gray-900' : 'text-gray-600'}>
                              {tag}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>

                  {activeTags.length > 0 && (
                    <div className="border-t px-3 py-2">
                      <button
                        onClick={() => setActiveTags([])}
                        className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        Clear all tags
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Active tag chips + result count */}
          {(activeTags.length > 0 || isFiltering) && (
            <div className="flex items-center justify-between mt-2">
              <div className="flex flex-wrap gap-1.5">
                {activeTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-eco-green/10 text-eco-green capitalize border border-eco-green/30"
                  >
                    {tag}
                    <button
                      onClick={() => toggleTag(tag)}
                      aria-label={`Remove ${tag} filter`}
                      className="hover:text-eco-green/70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              {!loading && (
                <span className="text-xs text-gray-400 shrink-0 ml-2">
                  {filtered.length} of {cards.length} cards
                </span>
              )}
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="overflow-y-auto flex-1 p-5">
          {loading && (
            <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
              Loading cards...
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex items-center justify-center h-40 text-gray-500 text-sm text-center px-4">
              {cards.length === 0
                ? 'No greeting cards found.'
                : 'No cards match this search or tag. Try other words or clear filters.'}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {filtered.map((card) => (
                <div key={card.id} className="flex flex-col rounded-lg overflow-hidden border border-gray-200 hover:border-gray-400 transition-colors group">
                  {/* 9:16 thumbnail */}
                  <div className="relative w-full" style={{ aspectRatio: '9/16' }}>
                    <img
                      src={card.background_image_url}
                      alt={card.name}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>

                  {/* Card info + select button */}
                  <div className="p-3 flex flex-col gap-2 bg-white">
                    <p className="text-sm font-medium text-gray-800 truncate">{card.name}</p>
                    {card.tags.length > 0 && (
                      <p className="text-xs text-gray-500 truncate capitalize">
                        {card.tags.join(', ')}
                      </p>
                    )}
                    <Button
                      size="sm"
                      className="w-full mt-1"
                      onClick={() => {
                        onSelect(card.background_image_url, card.text_overlays)
                        onClose()
                      }}
                    >
                      Select
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
