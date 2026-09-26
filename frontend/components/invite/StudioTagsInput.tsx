'use client'

import React, { useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'

export const MAX_LAYOUT_TAGS = 20
export const MAX_LAYOUT_TAG_LENGTH = 40

/** Same normalization the API applies, so the chip you see is the tag you save. */
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().split(/\s+/).join(' ').slice(0, MAX_LAYOUT_TAG_LENGTH)
}

/**
 * Merge raw tag strings into an existing list, normalized and de-duplicated.
 *
 * Exported and pure because the alternative — committing each tag with its own
 * onChange — makes every call read the same stale `tags` prop, so all but the
 * last one is silently dropped when a comma-separated list is pasted.
 */
export function mergeTags(existing: string[], raws: string[]): string[] {
  const next = [...existing]
  for (const raw of raws) {
    const tag = normalizeTag(raw)
    if (!tag || next.includes(tag) || next.length >= MAX_LAYOUT_TAGS) continue
    next.push(tag)
  }
  return next
}

export interface StudioTagsInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  /** Tags inherited from the linked design — displayed, never edited here. */
  designTags?: string[]
}

/**
 * Chip editor for a page layout's own tags. Enter or comma commits a tag;
 * Backspace on an empty field removes the last one.
 */
export default function StudioTagsInput({
  tags,
  onChange,
  designTags = [],
}: StudioTagsInputProps): React.ReactElement {
  const [draft, setDraft] = useState('')

  const addTags = (raws: string[]) => {
    const next = mergeTags(tags, raws)
    if (next.length !== tags.length) onChange(next)
  }

  const commit = (raw: string) => {
    setDraft('')
    addTags([raw])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(draft)
      return
    }
    if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1" aria-live="polite">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-eco-green-light px-2 py-0.5 text-xs text-eco-green"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              aria-label={`Remove tag ${tag}`}
              className="hover:text-red-600"
            >
              <X className="w-3 h-3" aria-hidden />
            </button>
          </span>
        ))}
      </div>
      <Input
        value={draft}
        onChange={(e) => {
          // Pasting "a, b, c" should produce three chips, not one.
          if (e.target.value.includes(',')) {
            const parts = e.target.value.split(',')
            const last = parts.pop() ?? ''
            addTags(parts)
            setDraft(last)
            return
          }
          setDraft(e.target.value)
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
        placeholder={
          tags.length >= MAX_LAYOUT_TAGS ? `Limit of ${MAX_LAYOUT_TAGS} tags reached` : 'Add a tag, press Enter'
        }
        disabled={tags.length >= MAX_LAYOUT_TAGS}
      />
      {designTags.length > 0 ? (
        <div className="mt-2">
          <p className="text-xs text-gray-500 mb-1">
            From the linked design (edit on the design itself):
          </p>
          <div className="flex flex-wrap gap-1">
            {designTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
