import { useCallback, useEffect, useState } from 'react'
import { API_URL } from '../config/api'
import { useAuth } from '../contexts/AuthContext'

export interface ItemFilaOs {
  id: number
  solicitacao_id: number
  status: string
  equipe_id: number | null
  equipe_nome: string | null
  protocolo: string
  tipo_problema: string
  prioridade: string | null
  endereco_informado: string | null
  criado_em: string
  motivo: string
  motivo_detalhe: string
}

export interface ResultadoProcessarFila {
  processadas: number
  atribuidas: number
  pendentes: number
}

export function useFilaDistribuicao() {
  const { token } = useAuth()
  const [fila, setFila] = useState<ItemFilaOs[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const headers = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    [token]
  )

  const fetchFila = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/api/ordens-servico/fila`, {
        headers: headers(),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setFila(Array.isArray(data.fila) ? data.fila : [])
    } catch {
      setError('Erro ao carregar a fila de distribuicao')
    } finally {
      setLoading(false)
    }
  }, [headers])

  const processarFila = useCallback(async (): Promise<{
    ok: boolean
    resultado?: ResultadoProcessarFila
    error?: string
  }> => {
    setSaving(true)
    try {
      const response = await fetch(`${API_URL}/api/ordens-servico/distribuir-fila`, {
        method: 'POST',
        headers: headers(),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        return { ok: false, error: (body && body.error) || `HTTP ${response.status}` }
      }
      await fetchFila()
      return {
        ok: true,
        resultado: {
          processadas: body.processadas,
          atribuidas: body.atribuidas,
          pendentes: body.pendentes,
        },
      }
    } catch {
      return { ok: false, error: 'Erro ao processar a fila' }
    } finally {
      setSaving(false)
    }
  }, [headers, fetchFila])

  useEffect(() => {
    fetchFila()
  }, [fetchFila])

  return {
    fila,
    loading,
    saving,
    error,
    refetch: fetchFila,
    processarFila,
  }
}
