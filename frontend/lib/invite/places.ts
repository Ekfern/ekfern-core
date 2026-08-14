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
export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<{ results: PlaceSuggestion[]; attribution: string }> {
  const q = query.trim()
  if (q.length < 3) return { results: [], attribution: '' }

  try {
    const response = await api.get('/api/events/places/suggest/', { params: { q }, signal })
    return {
      results: response.data?.results ?? [],
      attribution: response.data?.attribution ?? '',
    }
  } catch {
    return { results: [], attribution: '' }
  }
}
