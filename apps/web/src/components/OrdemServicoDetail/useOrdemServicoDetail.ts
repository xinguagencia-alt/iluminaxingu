import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { OrdemServicoDetailData } from './types'
import { API_URL } from '../../config/api'

interface UseOrdemServicoDetailResult {
  data: OrdemServicoDetailData | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useOrdemServicoDetail(id: number | null): UseOrdemServicoDetailResult {
  const { token } = useAuth()
  const [data, setData] = useState<OrdemServicoDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/ordens-servico/${id}/detalhe`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error('Erro ao carregar detalhes da ordem')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar com o servidor')
    } finally {
      setLoading(false)
    }
  }, [id, token])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  return {
    data,
    loading,
    error,
    refetch: fetchDetail,
  }
}
