'use client'

import React, { useId, useState } from 'react'
import { ArrowDown, ArrowUp, Link2, Plus, Trash2 } from 'lucide-react'
import type { GoodToKnowItem } from '@/lib/invite/schema'
import { GOOD_TO_KNOW_PRESETS, newGoodToKnowItem, remainingKinds } from '@/lib/invite/goodToKnow'
import { safeExternalUrl } from '@/lib/safeUrl'
import { GOOD_TO_KNOW_ICONS } from './GoodToKnowList'

interface GoodToKnowEditorProps {
  items: GoodToKnowItem[]
  onChange: (items: GoodToKnowItem[]) => void
  /** Orders the chips by what guests of this kind of event ask first. */
  eventType?: string | null
  /** Chips use the surrounding form's look; 'panel' is the editor sidebar. */
  variant?: 'form' | 'panel'
  /** Shown greyed out, not editable: the answers live on the invitation now. */
  readOnly?: boolean
}

/**
 * Add, edit, reorder and remove Good to know items.
 *
 * Shared by the create-event form and the tile's settings panel, so the two
 * never drift. A chip adds an empty row - its placeholder hints, it never
 * writes - and disappears once used: one dress code, one parking note.
 */
export default function GoodToKnowEditor({ items, onChange, eventType, variant = 'panel', readOnly = false }: GoodToKnowEditorProps) {
  const uid = useId()
  // Links stay folded until asked for; one already filled in starts open.
  const [linkOpen, setLinkOpen] = useState<Record<string, boolean>>({})

  const update = (id: string, patch: Partial<GoodToKnowItem>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    onChange(next)
  }

  const chips = readOnly ? [] : remainingKinds(items, eventType)
  const chipClass =
    variant === 'form'
      ? 'inline-flex h-11 items-center gap-2 rounded-full border border-eco-green-light bg-white pl-3 pr-4 text-sm font-medium text-eco-green hover:bg-eco-beige/40'
      : 'inline-flex h-9 items-center gap-1.5 rounded-full border border-gray-300 bg-white pl-2.5 pr-3 text-sm text-gray-800 hover:bg-gray-50'

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item, index) => {
            const preset = GOOD_TO_KNOW_PRESETS[item.kind]
            const Icon = GOOD_TO_KNOW_ICONS[item.kind]
            const textId = `gtk-${item.id}-text-${uid}`
            const urlId = `gtk-${item.id}-url-${uid}`
            const showLink = linkOpen[item.id] || !!item.url
            const badLink = !!item.url?.trim() && !safeExternalUrl(item.url)
            return (
              <li
                key={item.id}
                className={`flex items-start gap-3 rounded-lg border border-gray-200 p-3 ${readOnly ? 'bg-gray-50' : 'bg-white'}`}
              >
                <Icon className="mt-7 h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
                <div className="min-w-0 flex-1 space-y-2">
                  <label htmlFor={textId} className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {preset.label}
                  </label>
                  <input
                    id={textId}
                    value={item.text}
                    onChange={(e) => update(item.id, { text: e.target.value })}
                    placeholder={preset.placeholder}
                    readOnly={readOnly}
                    aria-readonly={readOnly}
                    className={`h-10 w-full rounded-md border border-gray-300 px-3 text-sm ${
                      readOnly ? 'cursor-not-allowed bg-gray-100 text-gray-500' : ''
                    }`}
                  />
                  {readOnly ? (
                    item.url ? (
                      <p className="flex items-center gap-2 text-sm text-gray-500">
                        <Link2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.url}</span>
                      </p>
                    ) : null
                  ) : showLink ? (
                    <div>
                      <label htmlFor={urlId} className="sr-only">
                        Link for {preset.label} (optional)
                      </label>
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
                        <input
                          id={urlId}
                          value={item.url ?? ''}
                          onChange={(e) => update(item.id, { url: e.target.value || undefined })}
                          placeholder={preset.linkPlaceholder}
                          inputMode="url"
                          aria-invalid={badLink}
                          aria-describedby={badLink ? `${urlId}-error` : undefined}
                          className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm"
                        />
                      </div>
                      {badLink && (
                        <p id={`${urlId}-error`} className="mt-1 text-xs text-red-700">
                          That doesn’t look like a web link, so guests will see it as plain text.
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLinkOpen((open) => ({ ...open, [item.id]: true }))}
                      className="text-sm font-medium text-eco-teal underline underline-offset-2"
                    >
                      + Add a link
                    </button>
                  )}
                </div>
                {!readOnly && <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${preset.label} up`}
                    className="rounded border border-gray-200 p-1 disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label={`Move ${preset.label} down`}
                    className="rounded border border-gray-200 p-1 disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(items.filter((candidate) => candidate.id !== item.id))}
                    aria-label={`Remove ${preset.label}`}
                    className="rounded border border-gray-200 p-1 text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>}
              </li>
            )
          })}
        </ul>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((kind) => {
            const Icon = GOOD_TO_KNOW_ICONS[kind]
            return (
              <button
                key={kind}
                type="button"
                onClick={() => onChange([...items, newGoodToKnowItem(kind)])}
                className={chipClass}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <Icon className="h-4 w-4" aria-hidden="true" />
                {GOOD_TO_KNOW_PRESETS[kind].label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
