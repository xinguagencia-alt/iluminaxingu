import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { OrdemServico, StatusOrdemServico } from './types'
import { API_URL } from '../../config/api'

interface UseOrdensServicoResult {
  ordens: OrdemServico[]
  loading: boolean
  error: string | null
  refetch: () => void
  atualizarStatus: (
    id: number,
    status: StatusOrdemServico,
    observacao_execucao?: string,
    resultado?: string
  ) => Promise<boolean>
  excluir: (id: number) => Promise<{ ok: boolean; erro?: string }>
}

export function useOrdensServico(): UseOrdensServicoResult {
  const { token } = useAuth()
  const [ordens, setOrdens] = useState<OrdemServico[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrdens = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/ordens-servico`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error('Erro ao carregar ordens de serviço')
      }

      const data = await response.json()
      setOrdens(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar com o servidor')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchOrdens()
  }, [fetchOrdens])

  const atualizarStatus = useCallback(
    async (
      id: number,
      status: StatusOrdemServico,
      observacao_execucao?: string,
      resultado?: string
    ): Promise<boolean> => {
      try {
        const response = await fetch(`${API_URL}/api/ordens-servico/${id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
            observacao_execucao: observacao_execucao || null,
            resultado: resultado || null,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Erro ao atualizar ordem')
        }

        await fetchOrdens()
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao conectar com o servidor')
        return false
      }
    },
    [token, fetchOrdens]
  )

  const excluir = useCallback(
    async (id: number): Promise<{ ok: boolean; erro?: string }> => {
      try {
        const response = await fetch(`${API_URL}/api/ordens-servico/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })

        const data = await response.json()

        if (!response.ok) {
          return { ok: false, erro: data.error || 'Erro ao excluir ordem' }
        }

        await fetchOrdens()
        return { ok: true }
      } catch {
        return { ok: false, erro: 'Erro ao conectar com o servidor' }
      }
    },
    [token, fetchOrdens]
  )

  return {
    ordens,
    loading,
    error,
    refetch: fetchOrdens,
    atualizarStatus,
    excluir,
  }
}
