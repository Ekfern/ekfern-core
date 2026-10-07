import api from '@/lib/api'

export interface PlaceSuggestion {
  label: string
  lat: number
  lng: number
}

/**
 * Address suggestions for the invite editor.
 *
 * Resolves to an empty list rather than throwing: a lookup being unavailable
 * should never stop a host typing an address by hand, and the caller treats
 * "no suggestions" and "service down" the same way.
 */
export type PlaceSearchStatus = 'ok' | 'unavailable'

export interface PlaceSearchResult {
  results: PlaceSuggestion[]
  attribution: string
  /**
   * Whether the lookup actually ran. An empty list means different things -
   * "no such address" is a real answer worth acting on, while "the service is
   * unreachable" is not - and the editor offers the manual fallback for both,
   * with different wording.
   */
  status: PlaceSearchStatus
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceSearchResult> {
  const q = query.trim()
  if (q.length < 3) return { results: [], attribution: '', status: 'ok' }

  try {
    const response = await api.get('/api/events/places/suggest/', { params: { q }, signal })
    return {
      results: response.data?.results ?? [],
      attribution: response.data?.attribution ?? '',
      // The proxy answers 200 with an empty list when the upstream lookup fails,
      // and says so, so a dead service is not mistaken for a missing address.
      status: response.data?.available === false ? 'unavailable' : 'ok',
    }
  } catch {
    return { results: [], attribution: '', status: 'unavailable' }
  }
}

/** A town picked in the create-event form: what the event stores, plus words to recognise it by. */
export interface CitySuggestion {
  label: string // "Udaipur, Rajasthan, India"
  name: string // "Udaipur"
  region: string // "Rajasthan, India" - empty for a city-state like Singapore
  country_code: string // ISO 3166-1 alpha-2, "IN"
  lat: number
  lng: number
  /** IANA zone from the town's coordinates; null when it could not be told, so the host picks. */
  timezone: string | null
}

export interface CitySearchResult {
  results: CitySuggestion[]
  attribution: string
  /** Same meaning as for addresses: 'unavailable' sends the form to typing the city by hand. */
  status: PlaceSearchStatus
}

/**
 * Town and city suggestions for the create-event form, each with its country and time zone.
 *
 * Never throws. When the lookup is down the form shows a City field and a
 * Country dropdown instead, so creating an event never waits on this.
 */
export async function searchCities(
  query: string,
  signal?: AbortSignal,
): Promise<CitySearchResult> {
  const q = query.trim()
  if (q.length < 3) return { results: [], attribution: '', status: 'ok' }

  try {
    const response = await api.get('/api/events/places/suggest/', {
      params: { q, kind: 'city' },
      signal,
    })
    return {
      results: response.data?.results ?? [],
      attribution: response.data?.attribution ?? '',
      status: response.data?.available === false ? 'unavailable' : 'ok',
    }
  } catch {
    return { results: [], attribution: '', status: 'unavailable' }
  }
}
