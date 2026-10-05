'use client'

import React from 'react'
import { ArrowUpRight, BedDouble, Car, Phone, Shirt, Utensils, type LucideIcon } from 'lucide-react'
import type { GoodToKnowItem, GoodToKnowKind } from '@/lib/invite/schema'
import { GOOD_TO_KNOW_PRESETS, visibleItems } from '@/lib/invite/goodToKnow'
import { safeExternalUrl } from '@/lib/safeUrl'
import { recipe } from '@/lib/invite/recipes'

export const GOOD_TO_KNOW_ICONS: Record<GoodToKnowKind, LucideIcon> = {
  dress: Shirt,
  stay: BedDouble,
  parking: Car,
  food: Utensils,
  contact: Phone,
}

interface GoodToKnowListProps {
  items: GoodToKnowItem[] | undefined
  textAlign?: 'left' | 'center' | 'right'
}

/**
 * Event Details' answers to what guests ask the host the week before: dress
 * code, stay, parking, food, who to call. Each is its label over the host's
 * words, linked when the host gave a link that is safe to open.
 *
 * Renders nothing when no item has words in it - the live invitation renders
 * through here too, so an empty prompt would reach guests.
 */
export default function GoodToKnowList({ items, textAlign = 'center' }: GoodToKnowListProps) {
  const shown = visibleItems(items)
  if (shown.length === 0) return null

  // Rows read left to right whatever the tile's alignment: an icon beside
  // ragged centred lines reads as a list that lost its margin. The block sits
  // where the alignment says.
  const placement: React.CSSProperties =
    textAlign === 'center' ? { marginInline: 'auto' } : textAlign === 'right' ? { marginInlineStart: 'auto' } : {}

  return (
    <ul className="flex w-full max-w-[420px] flex-col gap-4 text-left" style={placement}>
      {shown.map((item) => {
        const Icon = GOOD_TO_KNOW_ICONS[item.kind]
        const label = GOOD_TO_KNOW_PRESETS[item.kind]?.label ?? ''
        const href = safeExternalUrl(item.url)
        const text = item.text.trim()
        return (
          <li key={item.id} className="flex items-start gap-3">
            {Icon && <Icon className="mt-0.5 h-5 w-5 shrink-0 opacity-70" aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 opacity-70" style={recipe('eyebrow')}>
                {label}
              </div>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-words underline decoration-1 underline-offset-4"
                  style={recipe('data')}
                >
                  {text}
                  {/* Inline, so a wrapped line keeps the arrow beside its last word. */}
                  <ArrowUpRight className="ml-1 inline h-3.5 w-3.5 align-[-2px] opacity-70" aria-hidden="true" />
                </a>
              ) : (
                <div className="break-words" style={recipe('data')}>
                  {text}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
