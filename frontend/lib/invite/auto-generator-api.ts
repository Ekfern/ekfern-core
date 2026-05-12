'use client'

import api from '@/lib/api'
import type { InviteConfig } from './schema'

/**
 * Client-side API helpers for the Page Layout Auto-Generator.
 *
 * All endpoints require ``HasLLMModuleAccess`` on the backend (superuser or
 * ``llm_module_access`` on the user). The frontend mirrors that on `/api/auth/me/`
 * for UX; the API remains authoritative.
 */

export interface GenerateLayoutDraft {
  /** Null until saved to Page Layout Studio; preview-only drafts stay ephemeral */
  id: number | null
  persisted?: boolean
  name: string
  description?: string
  thumbnail: string
  preview_alt?: string
  index: number
  config: InviteConfig
  status: 'draft' | 'published'
  visibility: 'internal' | 'public' | 'premium'
  meta: {
    recipe_id: string
    preset_id: string
    tone?: string
    overlay_strategy: string
    card_feeling?: string
    card_style?: string
    /** Vision layout cue: centered, busy, has_baked_text, etc. */
    card_composition?: string
    has_baked_text: boolean
    fallback?: boolean
    warnings: string[]
    copy_notes?: string
    /** Invitation headline from copy variant; used for studio display names */
    copy_headline?: string
    decoration_set_id?: string
    page_background_color?: string
    remix?: boolean
    parent_request_id?: string
    locks?: {
      recipe_id: string | null
      preset_id: string | null
      copy_idx: number | null
    }
  }
}

export interface GenerateLayoutResponse {
  session_id: string
  request_id: string
  /** Omit on very old cached API responses — required for Save for review */
  card_url?: string
  event_type?: string
  drafts: GenerateLayoutDraft[]
  card_analysis_summary?: {
    composition?: string
    visual_style?: string
    dominant_feeling?: string
    has_baked_text: boolean
    quiet_region_count: number
    suggested_page_bg_palette?: string[]
    bg_lightness_preference?: 'lighter' | 'match' | 'darker'
  }
  palette?: {
    bg?: string
    text?: string
    accent?: string
    muted?: string
    is_dark_bg?: boolean
    success?: boolean
  }
  spend_snapshot: {
    daily_usd: number
    monthly_usd: number
    user_daily_count: number
    user_monthly_count: number
  }
}

export interface GenerateLayoutRequest {
  card_url: string
  event_type: string
  concept?: string
  n_outputs?: number
  request_id: string
  has_sub_events?: boolean
  seed?: number | null
}

export interface LLMUsageSummary {
  kill_switch_enabled: boolean
  api_key_configured: boolean
  models: { vision: string; text: string }
  daily: { spend_usd: number; cap_usd: number; pct: number }
  monthly: { spend_usd: number; cap_usd: number; pct: number }
  alert_threshold_pct: number
  daily_breakdown: Array<{ day: string; cost_usd: number }>
  top_spenders: Array<{ user_id: number; cost_usd: number }>
  recent_calls: Array<{
    id: number
    user_id: number | null
    operation: string
    model: string
    input_tokens: number
    output_tokens: number
    cost_usd: number
    cache_hit: boolean
    success: boolean
    created_at: string | null
    request_id: string
  }>
  rate_limit_per_minute: number
  user: {
    daily_count?: number
    monthly_count?: number
    daily_quota?: number
    monthly_quota?: number
  }
  health?: {
    window_days: number
    vision: {
      total: number
      errors: number
      error_rate_pct: number
      cache_hit_pct: number
      p50_ms: number
      p95_ms: number
    }
    text: {
      total: number
      errors: number
      error_rate_pct: number
      cache_hit_pct: number
      p50_ms: number
      p95_ms: number
    }
    generations: {
      count: number
      fallback_pct: number
    }
  }
}

export async function generatePageLayouts(payload: GenerateLayoutRequest): Promise<GenerateLayoutResponse> {
  const response = await api.post<GenerateLayoutResponse>('/api/admin/page-layouts/generate/', payload)
  return response.data
}

export interface RemixLayoutRequest {
  parent_request_id: string
  request_id?: string
  n_outputs?: number
  seed?: number | null
  lock_recipe_id?: string | null
  lock_preset_id?: string | null
  lock_copy_idx?: number | null
}

export interface RemixLayoutResponse extends GenerateLayoutResponse {
  parent_request_id: string
  remix: true
}

export async function remixPageLayouts(payload: RemixLayoutRequest): Promise<RemixLayoutResponse> {
  const response = await api.post<RemixLayoutResponse>('/api/admin/page-layouts/remix/', payload)
  return response.data
}

export interface SaveReviewDraftsResponse {
  saved: GenerateLayoutDraft[]
  count: number
  request_id: string
}

/** Persist selected ephemeral AI previews as internal drafts in the Studio list */
export async function saveReviewDrafts(payload: {
  card_url: string
  event_type: string
  drafts: Partial<GenerateLayoutDraft & { persisted?: boolean }>[]
}): Promise<SaveReviewDraftsResponse> {
  const response = await api.post<SaveReviewDraftsResponse>(
    '/api/admin/page-layouts/save-review-drafts/',
    payload,
  )
  return response.data
}

export interface PublishLayoutResponse {
  id: number
  name: string
  status: string
  visibility: string
  card_sample: { id: number; name: string; auto_saved: boolean } | null
}

export async function publishPageLayout(
  id: number,
  options: { name?: string; visibility?: 'public' | 'premium' | 'internal' } = {},
): Promise<PublishLayoutResponse> {
  const response = await api.post<PublishLayoutResponse>(
    `/api/admin/page-layouts/${id}/publish/`,
    options,
  )
  return response.data
}

export interface BulkPublishResponse {
  updated: number
  ids: number[]
  cards_auto_saved: number
}

export async function bulkPublishPageLayouts(
  ids: number[],
  visibility: 'public' | 'premium' | 'internal' = 'public',
): Promise<BulkPublishResponse> {
  const response = await api.post<BulkPublishResponse>(
    '/api/admin/page-layouts/bulk-publish/',
    { ids, visibility },
  )
  return response.data
}

export async function rejectPageLayout(id: number): Promise<void> {
  // InvitePageLayoutViewSet's destroy is staff-gated; superusers always pass.
  await api.delete(`/api/events/invite-page-layouts/${id}/`)
}

export async function getLLMUsageSummary(days = 30): Promise<LLMUsageSummary> {
  const response = await api.get<LLMUsageSummary>(`/api/admin/llm-usage/summary/?days=${days}`)
  return response.data
}

/** Helper: read a generated draft's full config back via the existing layout endpoint. */
export async function getInvitePageLayoutById(id: number): Promise<{
  id: number
  name: string
  description: string
  thumbnail: string
  config: InviteConfig
  status: string
  visibility: string
}> {
  const response = await api.get(`/api/events/invite-page-layouts/${id}/`)
  return response.data as any
}
