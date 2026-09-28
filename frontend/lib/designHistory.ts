import api from '@/lib/api'

export interface DesignVersionSummaryTile {
  id?: string
  type?: string
  enabled?: boolean
}

/** The settings a host would have to retype to recreate a version by hand. */
export interface DesignVersionSummary {
  background_url?: string | null
  customColors?: Record<string, string> | null
  customFonts?: Record<string, string> | null
  texture?: Record<string, unknown> | null
  pageBorder?: Record<string, unknown> | null
  pageFrame?: Record<string, unknown> | null
  tiles: DesignVersionSummaryTile[]
}

export interface DesignVersion {
  id: number
  /** Null if the account that saved it has since been deleted. */
  saved_by: string | null
  label: string
  size_bytes: number
  created_at: string
  updated_at: string
}

/** One difference from the version before: where it was, and what it became. */
export interface DesignChange {
  location: string
  from: string
  to: string
}

export interface DesignVersionDetail extends DesignVersion {
  summary: DesignVersionSummary
  /** True for the oldest version, which has nothing to compare against. */
  is_first: boolean
  changes: DesignChange[]
}

/** Metadata only — configs are fetched one at a time, when one is opened. */
export async function listDesignVersions(eventId: number | string): Promise<DesignVersion[]> {
  try {
    const res = await api.get(`/api/events/${eventId}/design/versions/`)
    return res.data?.results ?? []
  } catch {
    // History is a convenience; never let it break the editor around it.
    return []
  }
}

export async function getDesignVersion(
  eventId: number | string,
  versionId: number,
): Promise<DesignVersionDetail> {
  const res = await api.get(`/api/events/${eventId}/design/versions/${versionId}/`)
  return res.data
}

/** "2 minutes ago" — good enough for a history list, no dependency needed. */
export function timeAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export const VERSION_LABELS: Record<string, string> = {
  published: 'Published',
  layout_applied: 'Layout applied',
}
