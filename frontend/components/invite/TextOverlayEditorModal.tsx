'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { TextOverlay } from '@/lib/invite/api'
import { FONT_OPTIONS } from '@/lib/invite/fonts'
import { createPortal } from "react-dom";

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
}

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
  startBoxHeight: number
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
  const fontPickerRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<DragState | null>(null)
  const contentEditableRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const fontButtonRef = useRef<HTMLButtonElement>(null)

  const [textBoxes, setTextBoxes] = useState<TextBox[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fontSizeInput, setFontSizeInput] = useState<string>('')
  const [showFontPicker, setShowFontPicker] = useState(false)
  const [fontPickerPosition, setFontPickerPosition] = useState({
    top: 0,
    left: 0,
  })

  // Keep a ref in sync so pointer-move callbacks always see the latest boxes
  const textBoxesRef = useRef<TextBox[]>([])
  useEffect(() => { textBoxesRef.current = textBoxes }, [textBoxes])

  // Reset state when the modal opens
  useEffect(() => {
    if (!open) return
    setTextBoxes(initialOverlays.map(overlayToTextBox))
    setSelectedId(null)
    setEditingId(null)
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
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const selectedBox = textBoxes.find((b) => b.id === selectedId) ?? null

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

  function addTextBox(): void {
    const newBox: TextBox = {
      id: makeId(),
      text: 'Placeholder text',
      x: 10, y: 20, width: 80, height: null,
      fontFamily: "'Playfair Display', serif",
      fontSize: 32,
      color: '#ffffff',
      bold: false, italic: false, underline: false, strikethrough: false,
      textAlign: 'center',
      verticalAlign: 'middle',
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
      startBoxX, startBoxY, startBoxWidth, startBoxHeight,
    } = dragState.current
    const dx = ((e.clientX - startPointerX) / rect.width) * 100
    const dy = ((e.clientY - startPointerY) / rect.height) * 100

    if (mode === 'resize') {
      setTextBoxes((prev) =>
        prev.map((b) => {
          if (b.id !== boxId) return b
          let newX = startBoxX, newY = startBoxY, newW = startBoxWidth, newH = startBoxHeight
          if (resizeHandle === 'se') {
            newW = clamp(startBoxWidth + dx, 10, 100 - startBoxX)
            newH = clamp(startBoxHeight + dy, 5, 100 - startBoxY)
          } else if (resizeHandle === 'sw') {
            const dw = -dx
            newW = clamp(startBoxWidth + dw, 10, startBoxX + startBoxWidth)
            newX = startBoxX + startBoxWidth - newW
            newH = clamp(startBoxHeight + dy, 5, 100 - startBoxY)
          } else if (resizeHandle === 'ne') {
            newW = clamp(startBoxWidth + dx, 10, 100 - startBoxX)
            const dh = -dy
            newH = clamp(startBoxHeight + dh, 5, startBoxY + startBoxHeight)
            newY = startBoxY + startBoxHeight - newH
          } else if (resizeHandle === 'nw') {
            const dw = -dx
            newW = clamp(startBoxWidth + dw, 10, startBoxX + startBoxWidth)
            newX = startBoxX + startBoxWidth - newW
            const dh = -dy
            newH = clamp(startBoxHeight + dh, 5, startBoxY + startBoxHeight)
            newY = startBoxY + startBoxHeight - newH
          }
          return { ...b, x: newX, y: newY, width: newW, height: newH }
        })
      )
    } else {
      setTextBoxes((prev) =>
        prev.map((b) => b.id !== boxId ? b : {
          ...b,
          x: clamp(startBoxX + dx, 0, 100 - b.width),
          y: clamp(startBoxY + dy, 0, 95),
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
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Dancing+Script:wght@400;700&family=Great+Vibes&family=Pacifico&family=Lora:ital,wght@0,400;0,600;1,400&family=Poppins:wght@400;600&family=Open+Sans:wght@400;600&family=Montserrat:wght@400;600&family=Raleway:wght@400;600&display=swap');` }} />

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        {/* Modal shell */}
        <div
          className="relative w-full max-w-4xl max-h-[95vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-visisible"
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


              {/* Font size */}
              <div className="flex items-center gap-1">
                <input
                  type="number" min={8} max={200}
                  value={fontSizeInput !== '' ? fontSizeInput : (selectedBox?.fontSize ?? 32)}
                  onFocus={() => setFontSizeInput(String(selectedBox?.fontSize ?? 32))}
                  onChange={(e) => setFontSizeInput(e.target.value)}
                  onBlur={() => {
                    const v = parseInt(fontSizeInput, 10)
                    if (!isNaN(v) && selectedBox) updateBox(selectedBox.id, 'fontSize', clamp(v, 8, 200))
                    setFontSizeInput('')
                  }}
                  className="w-16 text-sm border border-gray-300 rounded px-2 py-1 text-center"
                />
                <span className="text-xs text-gray-500">px</span>
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

              {/* Delete */}
              <button
                type="button"
                onClick={() => selectedBox && deleteBox(selectedBox.id)}
                className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-sm transition-colors"
                title="Delete"
              >
                Delete
              </button>
            </div>
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

          {/* Canvas area */}
          <div className="flex-1 flex flex-col items-center justify-start px-4 py-6 bg-gray-100 overflow-auto min-h-0">
            {!bgSrc && !bgGradient ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <p className="text-sm">No background set — set a background image or gradient first.</p>
              </div>
            ) : (
              <div style={{ height: '62vh', aspectRatio: '9 / 16' }} className="relative select-none">
                <div
                  ref={canvasRef}
                  className="relative overflow-hidden rounded-2xl shadow-2xl"
                  style={{ width: '100%', height: '100%', background: !bgSrc && bgGradient ? bgGradient : undefined, touchAction: 'none' }}
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
                          width: `${box.width}%`,
                          ...(box.height != null
                            ? { height: `${box.height}%`, overflow: 'hidden' }
                            : { minHeight: `${box.fontSize * 1.6}px` }),
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
                            startBoxHeight: 0,
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
                            wordBreak: 'break-word',
                            outline: 'none',
                            padding: '2px 4px',
                            textShadow: '0 1px 4px rgba(0,0,0,0.4)',
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

                        {/* Corner resize handles — only when selected and not editing */}
                        {isSelected && !isEditing && (
                          (['nw', 'ne', 'sw', 'se'] as ResizeHandle[]).map((handle) => {
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
                                    startBoxHeight: box.height ?? renderedHeightPct,
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
