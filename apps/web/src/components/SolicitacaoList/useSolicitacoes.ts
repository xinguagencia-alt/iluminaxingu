import { useState, useEffect, useCallback } from 'react'
import { Solicitacao, StatusSolicitacao } from './types'
import { useAuth } from '../../contexts/AuthContext'
import { API_URL } from '../../config/api'

export interface Filtros {
  status: string
  prioridade: string
  busca: string
  status_sla: string
}

interface UseSolicitacoesResult {
  solicitacoes: Solicitacao[]
  loading: boolean
  error: string | null
  filtros: Filtros
  setFiltro: (campo: keyof Filtros, valor: string) => void
  limparFiltros: () => void
  refetch: () => void
  atualizarStatus: (id: number, status: StatusSolicitacao, observacao?: string) => Promise<boolean>
  criarOrdem: (solicitacaoId: number, equipeId: number) => Promise<boolean>
}

const FILTROS_INICIAIS: Filtros = {
  status: '',
  prioridade: '',
  busca: '',
  status_sla: '',
}

export function useSolicitacoes(): UseSolicitacoesResult {
  const { token } = useAuth()
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS)

  const fetchSolicitacoes = useCallback(async (filtrosAtuais: Filtros) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (filtrosAtuais.status) params.set('status', filtrosAtuais.status)
      if (filtrosAtuais.prioridade) params.set('prioridade', filtrosAtuais.prioridade)
      if (filtrosAtuais.busca) params.set('busca', filtrosAtuais.busca)

      const queryString = params.toString()
      const url = `${API_URL}/api/solicitacoes${queryString ? `?${queryString}` : ''}`

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error('Erro ao carregar solicitações')
      }

      const data = await response.json()
      const filtrados = filtrosAtuais.status_sla
        ? data.filter((s: Solicitacao) => s.status_sla === filtrosAtuais.status_sla)
        : data
      setSolicitacoes(filtrados)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao conectar com o servidor'
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchSolicitacoes(filtros)
  }, [filtros, fetchSolicitacoes])

  const setFiltro = useCallback((campo: keyof Filtros, valor: string) => {
    setFiltros((prev) => ({ ...prev, [campo]: valor }))
  }, [])

  const limparFiltros = useCallback(() => {
    setFiltros(FILTROS_INICIAIS)
  }, [])

  const atualizarStatus = useCallback(
    async (id: number, status: StatusSolicitacao, observacao?: string): Promise<boolean> => {
      try {
        const response = await fetch(`${API_URL}/api/solicitacoes/${id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
            observacao: observacao || null,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Erro ao atualizar status')
        }

        await fetchSolicitacoes(filtros)
        return true
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Erro ao conectar com o servidor'
        )
        return false
      }
    },
    [token, filtros, fetchSolicitacoes]
  )

  const criarOrdem = useCallback(
    async (solicitacaoId: number, equipeId: number): Promise<boolean> => {
      try {
        const response = await fetch(`${API_URL}/api/ordens-servico`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ solicitacao_id: solicitacaoId, equipe_id: equipeId }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Erro ao criar ordem de serviço')
        }

        await fetchSolicitacoes(filtros)
        return true
      } catch {
        return false
      }
    },
    [token, filtros, fetchSolicitacoes]
  )

  return {
    solicitacoes,
    loading,
    error,
    filtros,
    setFiltro,
    limparFiltros,
    refetch: () => fetchSolicitacoes(filtros),
    atualizarStatus,
    criarOrdem,
  }
}
