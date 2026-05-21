'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import Fuse from 'fuse.js'
import { EVENT_TYPES, EVENT_TYPE_GROUPS, type EventTypeValue } from '@/lib/eventTypes'

interface Props {
  value: string
  onChange: (value: EventTypeValue | '') => void
  placeholder?: string
  id?: string
  className?: string
  /** Show an error outline */
  hasError?: boolean
}

export default function EventTypeSelect({
  value,
  onChange,
  placeholder = 'Wedding, birthday, corporate, and more…',
  id,
  className = '',
  hasError = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedLabel = useMemo(
    () => EVENT_TYPES.find((t) => t.value === value)?.label ?? '',
    [value]
  )

  const fuse = useMemo(
    () => new Fuse([...EVENT_TYPES], { keys: ['label', 'value'], threshold: 0.4, ignoreLocation: true }),
    []
  )

  const results = useMemo(() => {
    const q = query.trim()
    if (!q) return null // null = show grouped view
    return fuse.search(q).map((r) => r.item)
  }, [query, fuse])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0)
  }, [open])

  function select(val: EventTypeValue) {
    onChange(val)
    setOpen(false)
    setQuery('')
  }

  const triggerClass = [
    'flex h-10 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm',
    'focus:outline-none focus:ring-2 focus:ring-eco-green focus:ring-offset-1',
    hasError ? 'border-red-400' : 'border-gray-300 hover:border-gray-400',
    !value ? 'text-gray-400' : 'text-gray-900',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        id={id}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={triggerClass}
      >
        <span className="truncate">{selectedLabel || placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Search input */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search event types…"
                className="w-full rounded-md border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-eco-green"
              />
            </div>
          </div>

          {/* Options list */}
          <ul
            role="listbox"
            className="max-h-60 overflow-y-auto py-1"
            aria-label="Event types"
          >
            {/* Fuzzy results (flat list) */}
            {results !== null && results.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-gray-400">No match — try different words</li>
            )}

            {results !== null && results.map((t) => (
              <OptionRow
                key={t.value}
                label={t.label}
                value={t.value}
                selected={value === t.value}
                onSelect={select}
              />
            ))}

            {/* Grouped list when no search query */}
            {results === null && EVENT_TYPE_GROUPS.map((group) => (
              <li key={group} role="presentation">
                <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {group}
                </p>
                <ul>
                  {EVENT_TYPES.filter((t) => t.group === group).map((t) => (
                    <OptionRow
                      key={t.value}
                      label={t.label}
                      value={t.value}
                      selected={value === t.value}
                      onSelect={select}
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function OptionRow({
  label,
  value,
  selected,
  onSelect,
}: {
  label: string
  value: EventTypeValue
  selected: boolean
  onSelect: (v: EventTypeValue) => void
}) {
  return (
    <li role="option" aria-selected={selected}>
      <button
        type="button"
        onClick={() => onSelect(value)}
        className={`flex w-full items-center justify-between px-3 py-1.5 text-sm hover:bg-gray-50 ${
          selected ? 'text-eco-green font-medium' : 'text-gray-700'
        }`}
      >
        {label}
        {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
      </button>
    </li>
  )
}
