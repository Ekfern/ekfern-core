'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FONT_OPTIONS } from '@/lib/invite/fonts'

/**
 * A font dropdown that shows each face in itself.
 *
 * This has to be a list of buttons rather than a `<select>`: browsers ignore
 * `font-family` on an `<option>`, so a native dropdown of forty-eight fonts
 * renders forty-eight identical lines and a host has to pick a typeface by
 * reading its name. The pattern here is lifted from the text-overlay editor,
 * which solved it first; this is that solution made shareable so every font
 * control behaves the same way.
 *
 * The list is portalled to the body and positioned fixed, because these
 * controls sit inside scrolling settings panels that would otherwise clip it.
 */
export interface FontPickerProps {
  value?: string | null
  onChange: (family: string | undefined) => void
  /** Offer an entry that clears the choice, e.g. "Layout default". */
  defaultLabel?: string
  id?: string
  ariaLabel?: string
  className?: string
}

export default function FontPicker({
  value,
  onChange,
  defaultLabel,
  id,
  ariaLabel,
  className = '',
}: FontPickerProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 240 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = FONT_OPTIONS.find((f) => f.family === value)
  const label = selected?.name ?? (value ? value.split(',')[0].replace(/['"]/g, '') : defaultLabel ?? 'Select font')

  const place = useCallback(() => {
    const el = buttonRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPosition({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 220) })
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (listRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    // A fixed-position list would drift away from its trigger otherwise.
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  const choose = (family: string | undefined) => {
    onChange(family)
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!open) place()
          setOpen((prev) => !prev)
        }}
        className={`w-full flex items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-eco-green ${className}`}
      >
        <span className="truncate text-left" style={{ fontFamily: value || undefined }}>
          {label}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            style={{ position: 'fixed', top: position.top, left: position.left, width: position.width }}
            className="z-[9999] rounded-xl border border-gray-200 bg-white shadow-2xl"
          >
            <div className="max-h-80 overflow-y-auto py-1">
              {defaultLabel && (
                <button
                  type="button"
                  role="option"
                  aria-selected={!value}
                  onClick={() => choose(undefined)}
                  className={`w-full px-4 py-2 text-left text-sm text-gray-600 hover:bg-gray-100 ${!value ? 'bg-gray-50 font-medium' : ''}`}
                >
                  {defaultLabel}
                </button>
              )}
              {FONT_OPTIONS.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  role="option"
                  aria-selected={font.family === value}
                  onClick={() => choose(font.family)}
                  className={`w-full px-4 py-2.5 text-left hover:bg-gray-100 ${font.family === value ? 'bg-gray-50' : ''}`}
                >
                  {/* The point of the whole component: the name is set in the
                      face it names, so a host chooses by looking. */}
                  <span className="text-base" style={{ fontFamily: font.family }}>
                    {font.name}
                  </span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
