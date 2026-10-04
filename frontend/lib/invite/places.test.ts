/**
 * City lookup for the create-event form: it must never throw, and it must say
 * when the service is down so the form can offer City + Country instead.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...args: unknown[]) => get(...args) } }))

import { searchCities } from './places'

const udaipur = {
  label: 'Udaipur, Rajasthan, India',
  name: 'Udaipur',
  region: 'Rajasthan, India',
  country_code: 'IN',
  lat: 24.5854,
  lng: 73.7125,
  timezone: 'Asia/Kolkata',
}

describe('searchCities', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('does not ask until three letters are typed', async () => {
    expect(await searchCities('ud')).toEqual({ results: [], attribution: '', status: 'ok' })
    expect(get).not.toHaveBeenCalled()
  })

  it('asks for towns, not addresses', async () => {
    get.mockResolvedValue({ data: { results: [udaipur], attribution: 'Search by OpenStreetMap', available: true } })
    const result = await searchCities('  udai ')
    expect(get).toHaveBeenCalledWith('/api/events/places/suggest/', {
      params: { q: 'udai', kind: 'city' },
      signal: undefined,
    })
    expect(result).toEqual({ results: [udaipur], attribution: 'Search by OpenStreetMap', status: 'ok' })
  })

  it('reports the service as unavailable when the backend says so', async () => {
    get.mockResolvedValue({ data: { results: [], attribution: '', available: false } })
    expect((await searchCities('udaipur')).status).toBe('unavailable')
  })

  it('treats a failed request as unavailable rather than throwing', async () => {
    get.mockImplementation(() => Promise.reject(new Error('Network Error')))
    expect(await searchCities('udaipur')).toEqual({ results: [], attribution: '', status: 'unavailable' })
  })

  it('an empty answer from a working service is a real "no match"', async () => {
    get.mockResolvedValue({ data: { results: [], attribution: 'Search by OpenStreetMap', available: true } })
    expect((await searchCities('qqqqqq')).status).toBe('ok')
  })
})
