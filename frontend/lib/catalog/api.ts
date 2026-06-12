import api from '@/lib/api'
import type {
  CatalogItem,
  CatalogResponse,
  HostCatalog,
  PublicCatalog,
  ResponseStatus,
} from './types'
import type { CatalogSource } from './source'

// ---------------------------------------------------------------------------
// Host endpoints (authenticated)
// ---------------------------------------------------------------------------

export async function getCatalog(eventId: number): Promise<HostCatalog> {
  const r = await api.get(`/api/events/${eventId}/catalog/`)
  return r.data
}

export async function updateCatalog(
  eventId: number,
  data: Partial<HostCatalog>,
): Promise<HostCatalog> {
  const r = await api.patch(`/api/events/${eventId}/catalog/`, data)
  return r.data
}

export async function getCatalogItems(eventId: number): Promise<CatalogItem[]> {
  const r = await api.get(`/api/events/${eventId}/catalog/items/`)
  return r.data
}

export async function createCatalogItem(
  eventId: number,
  data: Omit<CatalogItem, 'id' | 'catalog_id' | 'created_at' | 'updated_at'>,
): Promise<CatalogItem> {
  const r = await api.post(`/api/events/${eventId}/catalog/items/`, data)
  return r.data
}

export async function updateCatalogItem(
  eventId: number,
  itemId: number,
  data: Partial<CatalogItem>,
): Promise<CatalogItem> {
  const r = await api.patch(`/api/events/${eventId}/catalog/items/${itemId}/`, data)
  return r.data
}

export async function deleteCatalogItem(
  eventId: number,
  itemId: number,
): Promise<void> {
  await api.delete(`/api/events/${eventId}/catalog/items/${itemId}/`)
}

export async function uploadCatalogItemImage(
  eventId: number,
  itemId: number,
  file: File,
): Promise<{ image_url: string }> {
  const form = new FormData()
  form.append('image', file)
  const r = await api.post(
    `/api/events/${eventId}/catalog/items/${itemId}/upload-image/`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return r.data
}

export async function getCatalogResponses(eventId: number): Promise<CatalogResponse[]> {
  const r = await api.get(`/api/events/${eventId}/catalog/responses/`)
  return r.data
}

export async function updateResponseStatus(
  eventId: number,
  responseId: number,
  status: ResponseStatus,
): Promise<CatalogResponse> {
  const r = await api.patch(
    `/api/events/${eventId}/catalog/responses/${responseId}/`,
    { status },
  )
  return r.data
}

// ---------------------------------------------------------------------------
// Public endpoints (unauthenticated)
// ---------------------------------------------------------------------------

export async function getPublicCatalog(
  slug: string,
  guestToken?: string,
): Promise<PublicCatalog> {
  const params = new URLSearchParams()
  if (guestToken) params.set('g', guestToken)
  const qs = params.toString()
  const r = await api.get(`/api/catalog/${slug}/${qs ? `?${qs}` : ''}`)
  return r.data
}

export async function submitCatalogResponse(
  slug: string,
  payload: {
    catalog_item_id: number
    response_type: 'pledge' | 'interest' | 'external_click' | 'host_message'
    name?: string
    email?: string
    phone?: string
    amount?: number
    message?: string
    source?: CatalogSource
  },
  guestToken?: string,
): Promise<{ message: string; id: number }> {
  const params = guestToken ? `?g=${guestToken}` : ''
  const r = await api.post(`/api/catalog/${slug}/respond/${params}`, payload)
  return r.data
}
