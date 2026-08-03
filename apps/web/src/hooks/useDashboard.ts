import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { API_URL } from '../config/api'

export interface ContadoresDashboard {
  total: number
  abertas: number
  em_atendimento: number
  concluidas: number
  atrasadas: number
  vence_hoje: number
  alta_ou_urgente: number
  tempo_medio_horas: number
  taxa_conclusao: number
  postes_ativos: number
}

export interface OrdensDashboard {
  total: number
  abertas: number
  em_execucao: number
}

export interface SlaDashboard {
  dentro_do_prazo: number
  vence_hoje: number
  atrasada: number
}

export interface ItemBairro {
  bairro: string
  total: number
}

export interface ItemTipoProblema {
  tipo: string
  total: number
}

export interface SolicitacaoUrgente {
  id: number
  protocolo: string
  nome_solicitante: string
  tipo_problema: string
  status_atual: string
  prioridade: string
  criado_em: string
  prazo_sla: string
  status_sla: string
  horas_restantes: number | null
}

export interface DashboardData {
  contadores: ContadoresDashboard
  ordens: OrdensDashboard
  sla: SlaDashboard
  por_status: Record<string, number>
  por_prioridade: Record<string, number>
  por_bairro: ItemBairro[]
  por_tipo_problema: ItemTipoProblema[]
  urgentes: SolicitacaoUrgente[]
  postes_por_bairro: ItemBairro[]
}

interface UseDashboardResult {
  data: DashboardData | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useDashboard(): UseDashboardResult {
  const { token } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/dashboard/resumo`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error('Erro ao carregar dados do dashboard')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao conectar com o servidor'
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
