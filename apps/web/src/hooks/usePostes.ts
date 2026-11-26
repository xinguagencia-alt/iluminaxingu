import { useState, useEffect, useCallback } from 'react'
import { MapMarker } from '../components/MapPicker/MapPicker'
import { API_URL } from '../config/api'

interface UsePostesResult {
  postes: MapMarker[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function usePostes(): UsePostesResult {
  const [postes, setPostes] = useState<MapMarker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPostes = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/postes`)
      if (!response.ok) throw new Error('Erro ao carregar postes')
      const data = await response.json()
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar com o servidor')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPostes()
  }, [fetchPostes])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchPostes()
      }
    }
    const handleFocus = () => {
      fetchPostes()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [fetchPostes])

  return { postes, loading, error, refetch: fetchPostes }
}