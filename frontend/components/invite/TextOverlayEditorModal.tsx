'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from "react-dom";
import type { TextOverlay } from '@/lib/invite/api'
import { FONT_OPTIONS } from '@/lib/invite/fonts'
import { Plus, Minus } from "lucide-react"
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TextBox {
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number | null // % of canvas height, null = auto
  fontFamily: string
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  textAlign: 'left' | 'center' | 'right'
  verticalAlign: 'top' | 'middle' | 'bottom'
  shadowX: number
  shadowY: number
  shadowBlur: number
  shadowOpacity: number
  shadowColor: string,
}

/**
 * The width the invite actually renders a card at (`max-w-sm`). Overlay
 * positions are percentages but font sizes are absolute pixels, so the two
 * only agree at one width: draw the canvas at any other size and 32px type
 * looks bigger or smaller against the card than a guest will ever see it, and
 * wraps differently. So the canvas is always built at this width and scaled to
 * fit, rather than rebuilt at whatever size happens to be available.
 */
const CARD_REFERENCE_WIDTH = 384

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

interface DragState {
  mode: 'move' | 'resize'
  resizeHandle: ResizeHandle | null
  boxId: string
  startPointerX: number
  startPointerY: number
  startBoxX: number
  startBoxY: number
  startBoxWidth: number
  /**
   * The box's rendered width as a percentage of the canvas. `width` on the box
   * is a stored number the render ignores — the box is `fit-content` — so
   * clamping against it pinned every box inside the leftmost 20% of the card.
   */
  renderedWidthPct: number
  /** Rendered height as a percentage of the canvas, for the same reason. */
  renderedBoxHeightPct: number
  startBoxHeight: number
  startFontSize: number
}

export interface Props {
  open: boolean
  bgSrc: string | undefined
  bgGradient?: string
  initialOverlays: TextOverlay[]
  onSave: (overlays: TextOverlay[]) => void
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function overlayToTextBox(overlay: TextOverlay): TextBox {
  return {
    ...overlay,
    height: null,
    verticalAlign: overlay.verticalAlign ?? 'middle',
    shadowX: overlay.shadowX ?? 0,
    shadowY: overlay.shadowY ?? 1,
    shadowBlur: overlay.shadowBlur ?? 4,
    shadowOpacity: overlay.shadowOpacity ?? 0.8,
    shadowColor: overlay.shadowColor ?? '#000000',
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TextOverlayEditorModal({
  open,
  bgSrc,
  bgGradient,
  initialOverlays,
  onSave,
  onClose,
}: Props): React.ReactElement | null {
  const canvasRef = useRef<HTMLDivElement>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const fontPickerRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<DragState | null>(null)
  const contentEditableRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const fontButtonRef = useRef<HTMLButtonElement>(null)
  const holdTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const effectsButtonRef = useRef<HTMLButtonElement>(null)
  const effectsRef = useRef<HTMLDivElement>(null)

  const [canvasScale, setCanvasScale] = useState(1)
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fontSizeInput, setFontSizeInput] = useState<string>('')
  const [showFontPicker, setShowFontPicker] = useState(false)
  const [fontPickerPosition, setFontPickerPosition] = useState({
    top: 0,
    left: 0,
  })
  const [showEffects, setShowEffects] = useState(false)
  const [effectsPosition, setEffectsPosition] = useState({
    top: 0,
    left: 0,
  })
  const selectedBox = textBoxes.find((b) => b.id === selectedId) ?? null
  const changeFontSize = (newSize: number) => {
    if (!selectedBox) return

    const size = clamp(newSize, 12, 200)

    updateBox(selectedBox.id, "fontSize", size)
    setFontSizeInput(String(size))
  }
  const startChangingFontSize = (direction: 1 | -1) => {
    if (!selectedBox) return

    // Start repeating only after 400ms
    holdTimeout.current = setTimeout(() => {
      holdInterval.current = setInterval(() => {
        const current = textBoxesRef.current.find(
          box => box.id === selectedBox.id
        )

        if (!current) return

        changeFontSize(current.fontSize + direction)
      }, 80)
    }, 400)
  }

  const stopChangingFontSize = () => {
    if (holdTimeout.current) {
      clearTimeout(holdTimeout.current)
      holdTimeout.current = null
    }

    if (holdInterval.current) {
      clearInterval(holdInterval.current)
      holdInterval.current = null
    }
  }

  // Fit the reference-width canvas into whatever room the modal has.
  useEffect(() => {
    if (!open) return
    const el = canvasWrapRef.current
    if (!el) return
    const update = () => {
      // Fit on both axes. Taking width alone overflowed: the wrapper's width
      // comes from 62vh but a flex parent can shrink its height, so a canvas
      // scaled to the width was taller than the room actually left for it.
      const referenceHeight = (CARD_REFERENCE_WIDTH * 16) / 9
      const byWidth = el.clientWidth / CARD_REFERENCE_WIDTH
      const byHeight = el.clientHeight / referenceHeight
      setCanvasScale(Math.min(byWidth, byHeight) || 1)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, bgSrc, bgGradient])

  // Keep a ref in sync so pointer-move callbacks always see the latest boxes
  const textBoxesRef = useRef<TextBox[]>([])
  useEffect(() => { textBoxesRef.current = textBoxes }, [textBoxes])

  // Resolve the faces in use up front. Left to itself the browser resolves them
  // lazily, painting fallback metrics on some frames and the real face on
  // others — which is what made text flicker while being dragged. Keyed on the
  // spec list, not textBoxes, which changes on every pointer move.
  const fontSpecs = useMemo(
    () => Array.from(new Set(textBoxes.map((b) => `${b.fontSize}px ${b.fontFamily}`))).sort().join('|'),
    [textBoxes]
  )

  const loadFontSpecs = useCallback(() => {
    if (typeof document === 'undefined' || !document.fonts) return
    for (const spec of fontSpecs.split('|')) {
      if (spec) void document.fonts.load(spec)
    }
  }, [fontSpecs])

  useEffect(() => { loadFontSpecs() }, [loadFontSpecs])



  // Reset state when the modal opens
  useEffect(() => {
    if (!open) return
    setTextBoxes(initialOverlays.map(overlayToTextBox))
    setSelectedId(null)
    setEditingId(null)
    setShowEffects(false)
  }, [open]) // intentionally only depends on `open` — we only reset on open

  // Auto-focus contentEditable when editing starts
  useEffect(() => {
    if (!editingId) return
    const el = contentEditableRefs.current.get(editingId)
    if (!el) return
    const text = textBoxesRef.current.find((b) => b.id === editingId)?.text ?? ''
    el.innerText = text
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
  }, [editingId])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        fontPickerRef.current &&
        !fontPickerRef.current.contains(event.target as Node)
      ) {
        setShowFontPicker(false)
      }

      if (
        effectsRef.current &&
        !effectsRef.current.contains(event.target as Node) &&
        effectsButtonRef.current &&
        !effectsButtonRef.current.contains(event.target as Node)
      ) {
        setShowEffects(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // ------------------------------------------------------------------
  // Box mutation helpers
  // ------------------------------------------------------------------

  function updateBox<K extends keyof TextBox>(id: string, key: K, value: TextBox[K]): void {
    setTextBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, [key]: value } : b)))
  }

  function toggleProp(id: string, key: 'bold' | 'italic' | 'underline' | 'strikethrough'): void {
    setTextBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, [key]: !b[key] } : b)))
  }

  function deleteBox(id: string): void {
    setTextBoxes((prev) => prev.filter((b) => b.id !== id))
    if (selectedId === id) setSelectedId(null)
    if (editingId === id) setEditingId(null)
  }

  // Delete / Backspace removes the selected box — the gesture every canvas
  // editor answers to, and the one a host reaches for before hunting the
  // toolbar. Inert while text is being edited or any other field has focus, so
  // it never eats a character the host meant to type. The `open` guard matters:
  // this component stays mounted and renders null when closed, so without it a
  // dismissed modal would keep swallowing Delete keys from the page behind it.
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (!selectedId || editingId) return
      const active = document.activeElement as HTMLElement | null
      if (
        active &&
        (active.isContentEditable ||
          active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT')
      ) {
        return
      }
      e.preventDefault()
      deleteBox(selectedId)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedId, editingId])

  function addTextBox(): void {
    const newBox: TextBox = {
      id: makeId(),
      text: 'Placeholder text',
      x: 10,
      y: 20,
      width: 80,
      height: null,

      fontFamily: '"Playfair Display", serif',
      fontSize: 32,
      color: '#ffffff',
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      textAlign: 'center',
      verticalAlign: 'middle',
      shadowX: 0,
      shadowY: 1,
      shadowBlur: 4,
      shadowOpacity: 0.8,
      shadowColor: "#000000",
    }
    setTextBoxes((prev) => [...prev, newBox])
    setSelectedId(newBox.id)
  }

  // ------------------------------------------------------------------
  // Drag / resize
  // ------------------------------------------------------------------
 
  const handleCanvasPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const {
      mode, resizeHandle, boxId,
      startPointerX, startPointerY,
      startBoxX, startBoxY, startBoxWidth, startBoxHeight, startFontSize, renderedWidthPct, renderedBoxHeightPct
    } = dragState.current
    const dx = ((e.clientX - startPointerX) / rect.width) * 100
    const dy = ((e.clientY - startPointerY) / rect.height) * 100

    const dragDistance = Math.hypot(
      e.clientX - startPointerX,
      e.clientY - startPointerY
    )

    const MIN_FONT_SIZE = 12
    const MAX_FONT_SIZE = 200

    if (mode === 'resize') {
      setTextBoxes((prev) =>
        prev.map((b) => {
          if (b.id !== boxId) return b

          const direction =
            (e.clientX - startPointerX) + (e.clientY - startPointerY) >= 0 ? 1 : -1

          const fontSize = clamp(
            Math.round(startFontSize + direction * dragDistance * 0.08),
            MIN_FONT_SIZE,
            MAX_FONT_SIZE
          )


          return {
            ...b,
            fontSize,
          }
        })
      )
    } else {
      setTextBoxes((prev) =>
        prev.map((b) => b.id !== boxId ? b : {
          ...b,
          // The whole box stays in view, with a 1% gutter off every edge. The
          // card clips, so anything past an edge is simply gone — and the box
          // is measured as rendered, not by the stored `width`, which the
          // editor does not use for layout.
          x: clamp(startBoxX + dx, 1, Math.max(1, 99 - renderedWidthPct)),
          y: clamp(startBoxY + dy, 1, Math.max(1, 99 - renderedBoxHeightPct)),
        })
      )
    }
  }, [])

  const handleCanvasPointerUp = useCallback(() => { dragState.current = null }, [])

  // ------------------------------------------------------------------
  // Save
  // ------------------------------------------------------------------

  function handleSave(): void {
    const overlays: TextOverlay[] = textBoxes.map((box) => ({ ...box }))
    onSave(overlays)
    onClose()
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (!open) return null

  return (
    <>
      {/* Google Fonts — same set as greeting card studio */}
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Dancing+Script:wght@400;700&family=Great+Vibes&family=Pacifico&family=Lora:ital,wght@0,400;0,600;1,400&family=Poppins:wght@400;600&family=Open+Sans:wght@400;600&family=Montserrat:wght@400;600&family=Raleway:wght@400;600&family=Manrope:wght@400;700&family=Outfit:wght@400;700&family=Urbanist:wght@400;700&family=DM+Sans:wght@400;700&family=Rubik:wght@400;700&family=Work+Sans:wght@400;700&family=Nunito:wght@400;700&family=Ubuntu:wght@400;700&family=Merriweather:wght@400;700&family=Libre+Baskerville:wght@400;700&family=Crimson+Text:wght@400;700&family=EB+Garamond:wght@400;700&family=Cinzel:wght@400;700&family=Allura&family=Alex+Brush&family=Parisienne&family=Satisfy&family=Sacramento&family=Kaushan+Script&family=Bebas+Neue&family=Anton&family=Abril+Fatface&family=Oswald:wght@400;700&family=Orbitron:wght@400;700&family=Lobster&display=swap');` }} />

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        {/* Modal shell */}
        <div
          className="relative w-full max-w-4xl h-[95vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-800">Edit Text Overlays</h2>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Toolbar */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap overflow-x-auto flex-shrink-0">
            <button
              type="button"
              onClick={addTextBox}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-400 text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium flex-none"
            >
              + Add Text
            </button>

            <div className="w-px h-5 bg-gray-200 flex-none" />

            <div className={`flex items-center gap-2 flex-wrap transition-opacity ${selectedBox ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              {/* Font family */}
              <div ref={fontPickerRef} className="relative w-48">
                <button
                  ref={fontButtonRef}
                  type="button"
                  onClick={() => {
                    if (!showFontPicker && fontButtonRef.current) {
                      const rect = fontButtonRef.current.getBoundingClientRect()

                      setFontPickerPosition({
                        top: rect.bottom + 6,
                        left: rect.left,
                      })
                    }

                    setShowFontPicker((prev) => !prev)
                  }}
                  className="w-full flex items-center justify-between rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm shadow-sm hover:border-blue-400 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-gray-500 font-semibold">Aa</span>

                    <span
                      style={{ fontFamily: selectedBox?.fontFamily }}
                      className="truncate text-xs font-medium"
                    >
                      {FONT_OPTIONS.find(
                        (f) => f.family === selectedBox?.fontFamily
                      )?.name ?? "Select Font"}
                    </span>
                  </div>

                  <svg
                    className={`w-4 h-4 transition-transform ${showFontPicker ? "rotate-180" : ""
                      }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>


              </div>


              {/* Font Size */}
              <div className="flex items-center h-9 rounded-lg border border-gray-300 bg-white shadow-sm overflow-hidden">

                {/* Decrease */}
                <button
                  type="button"
                  className="w-9 h-9 flex items-center justify-center border-r border-gray-200 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                  onMouseDown={() => startChangingFontSize(-1)}
                  onMouseUp={stopChangingFontSize}
                  onMouseLeave={stopChangingFontSize}
                  onClick={() => {
                    if (holdInterval.current) return
                    if (!selectedBox) return
                    changeFontSize(selectedBox.fontSize - 1)
                  }}
                >
                  <Minus size={14} />
                </button>

                {/* Input */}
                <input
                  type="number"
                  inputMode="numeric"
                  value={
                    fontSizeInput !== ""
                      ? fontSizeInput
                      : (selectedBox?.fontSize ?? 32)
                  }
                  onFocus={() =>
                    setFontSizeInput(String(selectedBox?.fontSize ?? 32))
                  }
                  onChange={(e) => {
                    const value = e.target.value
                    setFontSizeInput(value)

                    const v = parseInt(value, 10)

                    if (!isNaN(v) && selectedBox) {
                      changeFontSize(v)
                    }
                  }}
                  onWheel={(e) => {
                    e.preventDefault()

                    if (!selectedBox) return

                    const delta = e.deltaY < 0 ? 1 : -1

                    changeFontSize(selectedBox.fontSize + delta)
                  }}
                  onBlur={() => {
                    const v = parseInt(fontSizeInput, 10)

                    if (!isNaN(v)) {
                      changeFontSize(v)
                    }

                    setFontSizeInput("")
                  }}
                  className="w-12 text-center text-sm font-medium outline-none border-0 bg-transparent"
                />

                <span className="text-xs text-gray-500 pr-2">
                  px
                </span>

                {/* Increase */}
                <button
                  type="button"
                  className="w-9 h-9 flex items-center justify-center border-l border-gray-200 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                  onMouseDown={() => startChangingFontSize(1)}
                  onMouseUp={stopChangingFontSize}
                  onMouseLeave={stopChangingFontSize}
                  onClick={() => {
                    if (holdInterval.current) return
                    if (!selectedBox) return
                    changeFontSize(selectedBox.fontSize + 1)
                  }}
                >
                  <Plus size={14} />
                </button>

              </div>

              <div className="w-px h-5 bg-gray-200 flex-none" />

              {/* Bold / Italic / Underline / Strikethrough */}
              <button
                type="button"
                onClick={() => selectedBox && toggleProp(selectedBox.id, 'bold')}
                className={`px-2 py-1 rounded text-sm font-bold transition-colors ${selectedBox?.bold ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                title="Bold"
              >B</button>
              <button
                type="button"
                onClick={() => selectedBox && toggleProp(selectedBox.id, 'italic')}
                className={`px-2 py-1 rounded text-sm italic transition-colors ${selectedBox?.italic ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                title="Italic"
              >I</button>
              <button
                type="button"
                onClick={() => selectedBox && toggleProp(selectedBox.id, 'underline')}
                className={`px-2 py-1 rounded text-sm underline transition-colors ${selectedBox?.underline ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                title="Underline"
              >U</button>
              <button
                type="button"
                onClick={() => selectedBox && toggleProp(selectedBox.id, 'strikethrough')}
                className={`px-2 py-1 rounded text-sm line-through transition-colors ${selectedBox?.strikethrough ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                title="Strikethrough"
              >S</button>

              <div className="w-px h-5 bg-gray-200 flex-none" />

              {/* Horizontal alignment */}
              {(['left', 'center', 'right'] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  onClick={() => selectedBox && updateBox(selectedBox.id, 'textAlign', align)}
                  title={`Align ${align}`}
                  className={`px-2 py-1 rounded text-sm transition-colors ${selectedBox?.textAlign === align ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                >
                  {align === 'left' ? '\u2190' : align === 'center' ? '\u2194' : '\u2192'}
                </button>
              ))}

              <div className="w-px h-5 bg-gray-200 flex-none" />

              {/* Vertical alignment */}
              {(['top', 'middle', 'bottom'] as const).map((va) => (
                <button
                  key={va}
                  type="button"
                  onClick={() => selectedBox && updateBox(selectedBox.id, 'verticalAlign', va)}
                  title={`Vertical ${va}`}
                  className={`px-2 py-1 rounded text-sm transition-colors ${selectedBox?.verticalAlign === va ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                >
                  {va === 'top' ? '\u2191' : va === 'middle' ? '\u2195' : '\u2193'}
                </button>
              ))}

              <div className="w-px h-5 bg-gray-200 flex-none" />

              {/* Color picker */}
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={selectedBox?.color ?? '#ffffff'}
                  onChange={(e) => selectedBox && updateBox(selectedBox.id, 'color', e.target.value)}
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5"
                  title="Text color"
                />
                <input
                  type="text"
                  value={selectedBox?.color ?? '#ffffff'}
                  maxLength={7}
                  onChange={(e) => {
                    const v = e.target.value
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v) && selectedBox) {
                      updateBox(selectedBox.id, 'color', v)
                    }
                  }}
                  className="w-24 text-xs border border-gray-300 rounded px-2 py-1 font-mono"
                  placeholder="#ffffff"
                />
              </div>

              <div className="w-px h-5 bg-gray-200 flex-none" />

              <div className="relative">
                <button
                  ref={effectsButtonRef}
                  type="button"
                  onClick={() => {
                    if (!showEffects && effectsButtonRef.current) {
                      const rect = effectsButtonRef.current.getBoundingClientRect()

                      setEffectsPosition({
                        top: rect.bottom + 6,
                        left: rect.left,
                      })
                    }

                    setShowEffects((prev) => !prev)
                  }}
                  className="flex items-center gap-2 px-3 py-1 rounded text-sm border border-gray-300 bg-white hover:bg-gray-100 transition-colors"
                >
                  <span>✨ Effects</span>


                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${showEffects ? "rotate-180" : ""
                      }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

              </div>

            </div>

            {/* Delete lives OUTSIDE the dimmed group. Inside it, the group's
                `pointer-events-none` made the only way to remove a text box
                silently inert the moment the selection was lost — the button
                looked present but swallowed every click. A real `disabled`
                says "select something first" instead of doing nothing. */}
            <button
              type="button"
              disabled={!selectedBox}
              onClick={() => selectedBox && deleteBox(selectedBox.id)}
              className="px-2 py-1 rounded text-sm transition-colors text-red-500 hover:bg-red-50 disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
              title={selectedBox ? 'Delete text box' : 'Select a text box first'}
            >
              Delete
            </button>
          </div>
          {showFontPicker &&
            createPortal(
              <div
                ref={fontPickerRef}
                style={{
                  position: "fixed",
                  top: fontPickerPosition.top,
                  left: fontPickerPosition.left,
                  width: 288,
                }}
                className="rounded-xl border border-gray-200 bg-white shadow-2xl z-[9999]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="max-h-80 overflow-y-auto py-2">
                  {FONT_OPTIONS.map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => {
                        if (selectedBox) {
                          updateBox(selectedBox.id, "fontFamily", font.family)
                        }
                        setShowFontPicker(false)
                      }}
                      className="w-full text-left px-5 py-3 hover:bg-gray-100 transition-colors"
                    >
                      <span
                        style={{ fontFamily: font.family }}
                        className="text-lg"
                      >
                        {font.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>,
              document.body
            )}

          {showEffects &&
            createPortal(
              <div
                ref={effectsRef}
                style={{
                  position: "fixed",
                  top: effectsPosition.top,
                  left: effectsPosition.left,
                  width: 288,
                }}
                className="rounded-xl border border-gray-200 bg-white shadow-2xl z-[9999]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800">
                    Text Effects
                  </h3>

                  <div className="p-4 space-y-5">

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium text-gray-700">
                          Shadow
                        </span>

                        <span className="text-gray-500">
                          {selectedBox?.shadowBlur ?? 4}px
                        </span>
                      </div>

                      <input
                        type="range"
                        min="0"
                        max="20"
                        value={selectedBox?.shadowBlur ?? 4}
                        onChange={(e) => {
                          if (!selectedBox) return

                          const blur = Number(e.target.value)

                          updateBox(selectedBox.id, "shadowBlur", blur)
                          updateBox(selectedBox.id, "shadowOpacity", blur === 0 ? 0 : 0.8)
                        }}
                        className="w-full accent-blue-600"
                      />

                      <p className="text-xs text-gray-400 mt-1">
                        0 = No Shadow
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Shadow Color
                      </label>

                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={selectedBox?.shadowColor ?? "#000000"}
                          onChange={(e) => {
                            if (!selectedBox) return
                            updateBox(selectedBox.id, "shadowColor", e.target.value)
                          }}
                          className="w-10 h-10 rounded border border-gray-300 cursor-pointer p-0.5"
                        />

                        <input
                          type="text"
                          value={selectedBox?.shadowColor ?? "#000000"}
                          onChange={(e) => {
                            if (!selectedBox) return
                            updateBox(selectedBox.id, "shadowColor", e.target.value)
                          }}
                          className="flex-1 text-xs border border-gray-300 rounded px-2 py-2 font-mono"
                          placeholder="#000000"
                          maxLength={7}
                        />
                      </div>
                    </div>

                  </div>
                </div>
              </div>,
              document.body
            )}

          {/* Canvas area */}
          <div className="flex-1 flex flex-col items-center justify-start px-4 py-6 bg-gray-100 overflow-auto min-h-0">
            {!bgSrc && !bgGradient ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <p className="text-sm">No background set — set a background image or gradient first.</p>
              </div>
            ) : (
              <div
                ref={canvasWrapRef}
                // Takes the room the modal has left rather than a fixed 62vh.
                // A fixed height cannot know how tall the toolbar wrapped to on
                // this window, so on a narrow one it pushed the footer — Save
                // and Cancel — out of a shell that does not scroll. The canvas
                // is absolutely positioned inside and scaled to fit, so it
                // never sizes this box back.
                style={{ minHeight: 0 }}
                className="relative select-none flex-1 w-full"
              >
                <div
                  ref={canvasRef}
                  className="absolute top-0 left-0 right-0 mx-auto overflow-hidden rounded-2xl shadow-2xl"
                  style={{
                    width: CARD_REFERENCE_WIDTH,
                    height: (CARD_REFERENCE_WIDTH * 16) / 9,
                    // Centred by auto margins at its layout width, then scaled
                    // about that centre so it stays centred at any scale.
                    transformOrigin: 'top center',
                    transform: `scale(${canvasScale})`,
                    background: !bgSrc && bgGradient ? bgGradient : undefined,
                    touchAction: 'none',
                  }}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onClick={(e) => {
                    if (e.target === canvasRef.current || e.target === e.currentTarget) {
                      setSelectedId(null)
                      setEditingId(null)
                    }
                  }}
                >
                  {bgSrc && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={bgSrc}
                      alt="Background"
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    />
                  )}

                  {textBoxes.map((box) => {
                    const isSelected = selectedId === box.id
                    const isEditing = editingId === box.id
                    const justifyContent =
                      box.verticalAlign === 'top' ? 'flex-start' :
                        box.verticalAlign === 'bottom' ? 'flex-end' :
                          'center'
                    const textDecoration =
                      [box.underline ? 'underline' : '', box.strikethrough ? 'line-through' : '']
                        .filter(Boolean)
                        .join(' ') || 'none'

                    return (
                      <div
                        key={box.id}
                        style={{
                          position: 'absolute',
                          left: `${box.x}%`,
                          top: `${box.y}%`,
                          width: "fit-content",
                          height: "auto",
                          minHeight: `${box.fontSize * 1.6}px`,
                          overflow: "visible",
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent,
                          cursor: isEditing ? 'text' : 'move',
                          outline: isSelected ? '2px solid #3b82f6' : 'none',
                          outlineOffset: '2px',
                          borderRadius: '2px',
                          userSelect: isEditing ? 'text' : 'none',
                          zIndex: isSelected ? 10 : 5,
                          touchAction: isEditing ? 'auto' : 'none',
                        }}
                        onPointerDown={(e) => {
                          if (isEditing) return
                          e.stopPropagation()
                          loadFontSpecs() // faces lapse when idle; re-assert before a drag
                          e.currentTarget.setPointerCapture(e.pointerId)
                          setSelectedId(box.id)
                          if (!canvasRef.current) return
                          dragState.current = {
                            mode: 'move',
                            resizeHandle: null,
                            boxId: box.id,
                            startPointerX: e.clientX,
                            startPointerY: e.clientY,
                            startBoxX: box.x,
                            startBoxY: box.y,
                            startBoxWidth: box.width,
                            renderedWidthPct:
                              (e.currentTarget.offsetWidth / canvasRef.current.offsetWidth) * 100,
                            renderedBoxHeightPct:
                              (e.currentTarget.offsetHeight / canvasRef.current.offsetHeight) * 100,
                            startBoxHeight: 0,
                            startFontSize: box.fontSize,
                          }
                        }}
                        onPointerMove={handleCanvasPointerMove}
                        onPointerUp={handleCanvasPointerUp}
                        onClick={(e) => { e.stopPropagation(); setSelectedId(box.id) }}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          setSelectedId(box.id)
                          setEditingId(box.id)
                        }}
                      >
                        <div
                          ref={(el) => {
                            if (el) contentEditableRefs.current.set(box.id, el)
                            else contentEditableRefs.current.delete(box.id)
                          }}
                          contentEditable={isEditing}
                          suppressContentEditableWarning
                          style={{
                            fontFamily: box.fontFamily,
                            fontSize: `${box.fontSize}px`,
                            color: box.color,
                            fontWeight: box.bold ? 700 : 400,
                            fontStyle: box.italic ? 'italic' : 'normal',
                            textDecoration,
                            textAlign: box.textAlign,
                            lineHeight: 1.3,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'normal',
                            overflowWrap: 'normal',
                            outline: 'none',
                            padding: '2px 4px',
                            textShadow:
                              (box.shadowBlur ?? 0) === 0
                                ? "none"
                                : `0px 1px ${box.shadowBlur}px ${box.shadowColor ?? "#000000"
                                }${Math.round((box.shadowOpacity ?? 0.8) * 255)
                                  .toString(16)
                                  .padStart(2, "0")}`,
                            minWidth: '1em',
                          }}
                          onKeyDown={(e) => { if (e.key === 'Escape') setEditingId(null) }}
                          onBlur={(e) => {
                            updateBox(box.id, 'text', e.currentTarget.innerText)
                            setEditingId(null)
                          }}
                        >
                          {isEditing ? undefined : box.text}
                        </div>

                        {/* Remove handle — the direct way out, sitting on the
                            box itself so getting rid of unwanted text never
                            depends on finding the toolbar or keeping the
                            selection alive. Paired with the resize handle on
                            the opposite corner. */}
                        {isSelected && !isEditing && (
                          <button
                            type="button"
                            title="Remove this text"
                            aria-label="Remove this text"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteBox(box.id)
                            }}
                            style={{
                              position: 'absolute',
                              top: -10,
                              right: -10,
                              width: 22,
                              height: 22,
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#ffffff',
                              border: '2px solid #ef4444',
                              borderRadius: '9999px',
                              color: '#ef4444',
                              fontSize: 14,
                              lineHeight: 1,
                              cursor: 'pointer',
                              zIndex: 21,
                              touchAction: 'none',
                            }}
                          >
                            ×
                          </button>
                        )}

                        {/* Corner resize handles — only when selected and not editing */}
                        {isSelected && !isEditing && (
                          (['se'] as ResizeHandle[]).map((handle) => {
                            const isTop = handle.startsWith('n')
                            const isLeft = handle.endsWith('w')
                            const cursor =
                              handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize'
                            return (
                              <div
                                key={handle}
                                style={{
                                  position: 'absolute',
                                  [isTop ? 'top' : 'bottom']: -6,
                                  [isLeft ? 'left' : 'right']: -6,
                                  width: 20,
                                  height: 20,
                                  background: '#ffffff',
                                  border: '2px solid #3b82f6',
                                  borderRadius: 4,
                                  cursor,
                                  zIndex: 20,
                                  touchAction: 'none',
                                }}
                                onPointerDown={(e) => {
                                  e.stopPropagation()
                                  e.currentTarget.setPointerCapture(e.pointerId)
                                  const containerEl = e.currentTarget.parentElement
                                  const canvasEl = canvasRef.current
                                  const renderedHeightPct =
                                    containerEl && canvasEl
                                      ? (containerEl.offsetHeight / canvasEl.offsetHeight) * 100
                                      : 20
                                  dragState.current = {
                                    mode: 'resize',
                                    resizeHandle: handle,
                                    boxId: box.id,
                                    startPointerX: e.clientX,
                                    startPointerY: e.clientY,
                                    startBoxX: box.x,
                                    startBoxY: box.y,
                                    startBoxWidth: box.width,
                                    renderedWidthPct: containerEl && canvasEl
                                      ? (containerEl.offsetWidth / canvasEl.offsetWidth) * 100
                                      : box.width,
                                    renderedBoxHeightPct: renderedHeightPct,
                                    startBoxHeight: box.height ?? renderedHeightPct,
                                    startFontSize: box.fontSize,
                                  }
                                }}
                                onPointerMove={handleCanvasPointerMove}
                                onPointerUp={handleCanvasPointerUp}
                              />
                            )
                          })
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
            <p className="text-xs text-gray-400 flex-1">
              {textBoxes.length === 0
                ? 'No text overlays yet — click "+ Add Text" to start.'
                : `${textBoxes.length} text overlay${textBoxes.length !== 1 ? 's' : ''} — click a box to select, double-click to edit.`}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-lg bg-eco-green text-white text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
