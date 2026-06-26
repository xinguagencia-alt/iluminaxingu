import { useState, useEffect } from 'react'
import { MapMarker } from '../components/MapPicker/MapPicker'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333'

interface UsePostesResult {
  postes: MapMarker[]
  loading: boolean
  error: string | null
}

export function usePostes(): UsePostesResult {
  const [postes, setPostes] = useState<MapMarker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/api/postes`)
      .then((res) => {
        if (!res.ok) throw new Error('Erro ao carregar postes')
        return res.json()
      })
      .then((data) => {
        const markers: MapMarker[] = data
          .filter(
            (p: { latitude: number | null; longitude: number | null }) =>
              p.latitude !== null && p.longitude !== null
          )
          .map((p: { id: number; codigo: string; latitude: number; longitude: number }) => ({
            id: p.id,
            latitude: p.latitude,
            longitude: p.longitude,
            label: p.codigo,
          }))
        setPostes(markers)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { postes, loading, error }
}
