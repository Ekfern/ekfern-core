'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { ChipTone, CoHostChipModel } from '@/lib/cohostChips'

const TONE_CLASSES: Record<ChipTone, string> = {
  // Not sent yet: dashed, so it reads as unsent next to a sent pending invite.
  draft: 'border border-dashed border-gray-400 bg-transparent text-gray-800',
  pending: 'border border-gray-400 bg-transparent text-gray-800',
  accepted: 'border border-emerald-600 bg-emerald-600 text-white',
  declined: 'border border-red-600 bg-red-600 text-white',
  left: 'border border-gray-300 bg-gray-100 text-gray-400',
}

const REMOVE_HOVER: Record<ChipTone, string> = {
  draft: 'hover:bg-gray-200',
  pending: 'hover:bg-gray-200',
  accepted: 'hover:bg-emerald-700',
  declined: 'hover:bg-red-700',
  left: 'hover:bg-gray-200',
}

export interface CoHostChipRowProps {
  chips: CoHostChipModel[]
  onRemove: (chip: CoHostChipModel) => void
  /** Called for chips that open settings (accepted co-hosts). */
  onOpen?: (chip: CoHostChipModel) => void
  /** Key of the chip whose settings are open, for aria-expanded. */
  openKey?: string | null
  disabled?: boolean
}

/**
 * One chip per invite, below the invite box. The chip's colour is its status;
 * hovering shows the status in words, and tapping a chip that has no settings
 * shows the same words underneath, since a phone has no hover.
 */
export default function CoHostChipRow({ chips, onRemove, onOpen, openKey, disabled }: CoHostChipRowProps) {
  const [noteKey, setNoteKey] = useState<string | null>(null)
  if (chips.length === 0) return null

  const noted = chips.find((c) => c.key === noteKey && !c.opensSettings)

  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-2" aria-label="Co-hosts">
        {chips.map((chip) => {
          const tone = TONE_CLASSES[chip.tone]
          return (
            <li
              key={chip.key}
              className={`inline-flex max-w-full items-center rounded-full text-sm ${tone}`}
              title={`${chip.label === chip.email ? chip.email : `${chip.label} · ${chip.email}`} — ${chip.detail}`}
            >
              <button
                type="button"
                onClick={() =>
                  chip.opensSettings && onOpen
                    ? onOpen(chip)
                    : setNoteKey((k) => (k === chip.key ? null : chip.key))
                }
                aria-expanded={chip.opensSettings ? openKey === chip.key : undefined}
                aria-label={`${chip.label}, ${chip.detail}${chip.opensSettings ? '. Show permissions' : ''}`}
                className="flex min-w-0 items-center gap-1 rounded-full py-1 pl-3 pr-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-eco-green"
              >
                {chip.tone === 'pending' ? <span aria-hidden>⏳</span> : null}
                <span className="max-w-[14rem] truncate">{chip.label}</span>
              </button>
              <button
                type="button"
                onClick={() => onRemove(chip)}
                disabled={disabled}
                aria-label={`Remove ${chip.label}`}
                className={`mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-eco-green ${REMOVE_HOVER[chip.tone]}`}
              >
                <X size={14} aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>
      {noted ? (
        <p className="text-xs text-gray-600" role="status">
          <span className="font-medium">{noted.email}</span> · {noted.detail}
        </p>
      ) : null}
    </div>
  )
}
