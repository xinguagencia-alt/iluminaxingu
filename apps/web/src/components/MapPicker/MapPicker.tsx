import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import styles from './MapPicker.module.css'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl

const XINGU_CENTER: [number, number] = [-6.6153, -51.9640]
const DEFAULT_ZOOM = 12

export interface MapMarker {
  id: number | string
  latitude: number
  longitude: number
  label: string
}

interface MapPickerProps {
  latitude: number | null
  longitude: number | null
  onLocationSelect: (lat: number, lng: number) => void
  onPostSelect?: (marker: MapMarker) => void
  markers?: MapMarker[]
}

const userIcon = L.divIcon({
  className: styles.userMarker,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
})

const postIcon = L.divIcon({
  className: styles.postMarker,
  iconSize: [20, 20],
  iconAnchor: [10, 20],
})

export function MapPicker({ latitude, longitude, onLocationSelect, onPostSelect, markers = [] }: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const userMarkerRef = useRef<L.Marker | null>(null)
  const postMarkersRef = useRef<L.Marker[]>([])

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const initialCenter: [number, number] =
      latitude !== null && longitude !== null
        ? [latitude, longitude]
        : XINGU_CENTER

    const map = L.map(mapRef.current).setView(initialCenter, DEFAULT_ZOOM)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      onLocationSelect(e.latlng.lat, e.latlng.lng)
    })

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (latitude !== null && longitude !== null) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([latitude, longitude])
      } else {
        userMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon }).addTo(map)
      }
      map.setView([latitude, longitude], map.getZoom())
    } else if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current)
      userMarkerRef.current = null
    }
  }, [latitude, longitude])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    postMarkersRef.current.forEach((m) => map.removeLayer(m))
    postMarkersRef.current = []

    markers.forEach((marker) => {
      const m = L.marker([marker.latitude, marker.longitude], { icon: postIcon })
        .bindPopup(`<strong>${marker.label}</strong>`)
        .addTo(map)

      if (onPostSelect) {
        m.on('click', () => onPostSelect(marker))
      }

      postMarkersRef.current.push(m)
    })
  }, [markers, onPostSelect])

  return (
    <div className={styles.mapContainer}>
      <div ref={mapRef} className={styles.map} />
      <p className={styles.hint}>Clique no mapa para selecionar a localizacao</p>
    </div>
  )
}
