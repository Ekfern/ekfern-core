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
