import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { PosteReparado } from './types'
import { API_URL } from '../../config/api'

interface UsePostesReparadosResult {
  postes: PosteReparado[]
  loading: boolean
  error: string | null
  refetch: (filtros?: { equipe_id?: number; data_inicio?: string; data_fim?: string }) => void
}

export function usePostesReparados(): UsePostesReparadosResult {
  const { token } = useAuth()
  const [postes, setPostes] = useState<PosteReparado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPostes = useCallback(
    async (filtros?: { equipe_id?: number; data_inicio?: string; data_fim?: string }) => {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        if (filtros?.equipe_id) params.append('equipe_id', String(filtros.equipe_id))
        if (filtros?.data_inicio) params.append('data_inicio', filtros.data_inicio)
        if (filtros?.data_fim) params.append('data_fim', filtros.data_fim)

        const queryString = params.toString()
        const url = `${API_URL}/api/ordens-servico/postes-reparados${queryString ? `?${queryString}` : ''}`

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          throw new Error('Erro ao carregar postes reparados')
        }

        const data = await response.json()
        setPostes(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao conectar com o servidor')
      } finally {
        setLoading(false)
      }
    },
    [token]
  )

  useEffect(() => {
    fetchPostes()
  }, [fetchPostes])

  return { postes, loading, error, refetch: fetchPostes }
}
