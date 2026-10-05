/**
 * Good to know: the answers to what guests ask the host the week before.
 *
 * Five kinds, each a line of text and an optional link. Deliberately not a
 * free-form list: anything else belongs in the Description tile, which already
 * takes rich text and links. A kind that the host has not filled in is never
 * shown, and nothing here is pre-filled - placeholders hint, they do not write.
 */

import { EVENT_TYPES, type EventTypeGroup } from '@/lib/eventTypes'
import type { GoodToKnowItem, GoodToKnowKind } from './schema'

export interface GoodToKnowPreset {
  /** What the guest reads above the answer, and the chip says. */
  label: string
  placeholder: string
  linkPlaceholder: string
}

export const GOOD_TO_KNOW_PRESETS: Record<GoodToKnowKind, GoodToKnowPreset> = {
  dress: { label: 'Dress code', placeholder: 'Pastels, Indo-western, black tie…', linkPlaceholder: 'Mood board link' },
  stay: { label: 'Stay', placeholder: 'Rooms held at the venue till…', linkPlaceholder: 'Booking link' },
  parking: { label: 'Parking', placeholder: 'Valet at the main gate…', linkPlaceholder: 'Map pin for parking' },
  food: { label: 'Food', placeholder: 'Veg & non-veg, dinner from 8 pm…', linkPlaceholder: 'Menu link' },
  contact: { label: 'Contact', placeholder: 'Who guests can call, and their number', linkPlaceholder: 'WhatsApp link' },
}

export const GOOD_TO_KNOW_KINDS = Object.keys(GOOD_TO_KNOW_PRESETS) as GoodToKnowKind[]

/** What a guest is most likely to ask, first. Keyed by the event type's group. */
const ORDER_BY_GROUP: Record<EventTypeGroup, GoodToKnowKind[]> = {
  'Life Events': ['dress', 'stay', 'contact', 'parking', 'food'],
  'Religious & Ceremonial': ['dress', 'food', 'parking', 'contact', 'stay'],
  'Professional & Business': ['parking', 'contact', 'food', 'dress', 'stay'],
  'Social & Community': ['parking', 'food', 'contact', 'dress', 'stay'],
  Entertainment: ['parking', 'food', 'contact', 'dress', 'stay'],
  'Food & Dining': ['food', 'dress', 'parking', 'contact', 'stay'],
  Other: ['dress', 'food', 'parking', 'stay', 'contact'],
}

/** The kinds to offer as chips for an event type, most-asked first. */
export function chipOrder(eventType?: string | null): GoodToKnowKind[] {
  const group = EVENT_TYPES.find((t) => t.value === eventType)?.group ?? 'Other'
  return ORDER_BY_GROUP[group]
}

/** Chips still to offer: one item per kind. */
export function remainingKinds(items: GoodToKnowItem[], eventType?: string | null): GoodToKnowKind[] {
  const used = new Set(items.map((item) => item.kind))
  return chipOrder(eventType).filter((kind) => !used.has(kind))
}

/** What a guest sees: items with words in them, in the host's order. */
export function visibleItems(items: GoodToKnowItem[] | undefined): GoodToKnowItem[] {
  return (items ?? []).filter((item) => item.text?.trim())
}

export function newGoodToKnowItem(kind: GoodToKnowKind): GoodToKnowItem {
  return { id: `gtk-${kind}-${Math.random().toString(36).slice(2, 10)}`, kind, text: '' }
}
