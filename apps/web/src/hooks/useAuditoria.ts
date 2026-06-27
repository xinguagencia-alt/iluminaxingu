import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../config/api'
import { useAuth } from '../contexts/AuthContext'

export interface AuditLog {
  id: number
  tabela: string
  registro_id: number | null
  acao: string
  dados_antes: Record<string, unknown> | null
  dados_depois: Record<string, unknown> | null
  usuario_id: number | null
  usuario_nome: string | null
  criado_em: string
}

interface UseAuditoriaResult {
  logs: AuditLog[]
  total: number
  loading: boolean
  error: string | null
  refetch: () => void
  carregarMais: () => void
}

export function useAuditoria(): UseAuditoriaResult {
  const { token } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const limit = 50

  const fetchLogs = useCallback(async (resetOffset = false) => {
    setLoading(true)
    setError(null)

    const currentOffset = resetOffset ? 0 : offset
    if (resetOffset) setOffset(0)

    try {
      const response = await fetch(
        `${API_URL}/api/auditoria?limit=${limit}&offset=${currentOffset}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      if (!response.ok) {
        throw new Error('Erro ao carregar auditoria')
      }

      const data = await response.json()
      if (resetOffset) {
        setLogs(data.logs)
      } else {
        setLogs((prev) => [...prev, ...data.logs])
      }
      setTotal(data.total)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao conectar com o servidor'
      )
    } finally {
      setLoading(false)
    }
  }, [token, offset])

  useEffect(() => {
    fetchLogs(true)
  }, [])

  const carregarMais = useCallback(() => {
    const newOffset = offset + limit
    setOffset(newOffset)
    fetchLogs(false)
  }, [offset, fetchLogs])

  return {
    logs,
    total,
    loading,
    error,
    refetch: () => fetchLogs(true),
    carregarMais,
  }
}
