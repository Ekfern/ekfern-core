'use client'

import React, { useEffect, useRef, useState } from 'react'
// Ships with this component's chunk, which only loads in the editor.
import 'leaflet/dist/leaflet.css'

/**
 * Drag-a-pin location picker for the invite editor.
 *
 * Typing latitude and longitude is an engineer's way to describe a place. A
 * host knows where the venue is by looking at it - so the map is the primary
 * control and the coordinate fields are what it writes into.
 *
 * Leaflet is loaded on demand and only ever here. The editor is one host, once;
 * a guest's invitation must stay light, which is why the invite renders its map
 * a different way rather than sharing this component.
 */
export interface DirectionsMapPickerProps {
  lat: number
  lng: number
  zoom?: number
  onMove: (lat: number, lng: number) => void
}

// Rounded the way coordinates are quoted in practice - roughly a metre, which
// is finer than anyone can place a pin by hand.
const round = (value: number) => Number(value.toFixed(6))

export default function DirectionsMapPicker({ lat, lng, zoom = 16, onMove }: DirectionsMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const onMoveRef = useRef(onMove)
  const [failed, setFailed] = useState(false)

  // Keep the latest callback without re-running the setup effect.
  useEffect(() => {
    onMoveRef.current = onMove
  }, [onMove])

  useEffect(() => {
    let cancelled = false
    let cleanup = () => {}

    ;(async () => {
      try {
        const L = (await import('leaflet')).default
        if (cancelled || !containerRef.current) return

        const map = L.map(containerRef.current, {
          center: [lat, lng],
          zoom,
          // A map inside a scrolling form must not steal the wheel: the page
          // should keep scrolling when the cursor crosses it.
          scrollWheelZoom: false,
          attributionControl: true,
        })

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        }).addTo(map)

        // A DivIcon rather than Leaflet's default marker: the default pulls PNG
        // assets by relative path, which bundlers famously break, and this way
        // the pin is styled by us.
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#0B3D2E;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 22],
        })

        const marker = L.marker([lat, lng], { draggable: true, icon, keyboard: true }).addTo(map)
        marker.on('dragend', () => {
          const { lat: newLat, lng: newLng } = marker.getLatLng()
          onMoveRef.current(round(newLat), round(newLng))
        })

        // Clicking anywhere is faster than dragging across the whole map.
        map.on('click', (event: any) => {
          marker.setLatLng(event.latlng)
          onMoveRef.current(round(event.latlng.lat), round(event.latlng.lng))
        })

        mapRef.current = map
        markerRef.current = marker
        cleanup = () => {
          map.off()
          map.remove()
          mapRef.current = null
          markerRef.current = null
        }
      } catch {
        // Offline, blocked, or the chunk failed: the coordinate fields below
        // still work, so the host is never stuck.
        if (!cancelled) setFailed(true)
      }
    })()

    return () => {
      cancelled = true
      cleanup()
    }
    // Built once; later coordinate changes are applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Follow coordinates that changed elsewhere - a suggestion picked, or a value
  // typed into the fields - without rebuilding the map.
  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return
    const current = marker.getLatLng()
    if (round(current.lat) === round(lat) && round(current.lng) === round(lng)) return
    marker.setLatLng([lat, lng])
    map.panTo([lat, lng])
  }, [lat, lng])

  if (failed) return null

  return (
    <div className="mt-2">
      <div
        ref={containerRef}
        className="h-52 w-full overflow-hidden rounded-md border border-gray-200"
        // Leaflet needs a real height before it can size its tiles.
        style={{ minHeight: '208px' }}
      />
      <p className="mt-1 text-xs text-gray-500">
        Drag the pin, or tap the map, to place the venue exactly.
      </p>
    </div>
  )
}
