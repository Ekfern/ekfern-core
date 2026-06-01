import type { TextOverlay } from '@/lib/invite/schema'

export type DesignSourceType = 'sample' | 'gradient' | 'upload' | 'gif' | 'none'

export interface SelectedDesignContext {
  eventId: number
  sourceType: DesignSourceType
  sampleId?: number
  /** Stable design code of the catalog sample (e.g. DSGN-0042). Drives layout filtering. */
  sampleCode?: string
  sampleName?: string
  sampleTags?: string[]
  bgUrl?: string
  bgGradient?: string
  textOverlays?: TextOverlay[]
  selectedAt: string
}

function storageKey(eventId: number): string {
  return `selected-design-context-${eventId}`
}

export function saveSelectedDesignContext(context: SelectedDesignContext): void {
  if (!context.eventId || Number.isNaN(context.eventId)) return
  localStorage.setItem(storageKey(context.eventId), JSON.stringify(context))
}

export function loadSelectedDesignContext(eventId: number): SelectedDesignContext | null {
  if (!eventId || Number.isNaN(eventId)) return null
  const raw = localStorage.getItem(storageKey(eventId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SelectedDesignContext
    if (!parsed || parsed.eventId !== eventId) return null
    return parsed
  } catch {
    return null
  }
}

export function clearSelectedDesignContext(eventId: number): void {
  if (!eventId || Number.isNaN(eventId)) return
  localStorage.removeItem(storageKey(eventId))
}
