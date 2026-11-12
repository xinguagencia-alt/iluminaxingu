import { useCallback, useEffect, useState } from 'react'
import { API_URL } from '../config/api'
import { useAuth } from '../contexts/AuthContext'

export type ModoOperacional = 'manual' | 'automatico'

interface FluxoConfig {
  modo: ModoOperacional
  modo_label: string
  padrao: ModoOperacional
}

interface ResultadoAlteracao {
  ok: boolean
  error?: string
}

export function useFluxo() {
  const { token } = useAuth()
  const [config, setConfig] = useState<FluxoConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token])

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/api/fluxo`, { headers: headers() })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setConfig(data)
    } catch {
      setError('Erro ao carregar o modo do fluxo')
    } finally {
      setLoading(false)
    }
  }, [headers])

  const alterarModo = useCallback(async (modo: ModoOperacional): Promise<ResultadoAlteracao> => {
    setSaving(true)
    try {
      const response = await fetch(`${API_URL}/api/fluxo`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ modo }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        return { ok: false, error: (body && body.error) || `Erro HTTP ${response.status}` }
      }
      await fetchConfig()
      return { ok: true }
    } catch {
      return { ok: false, error: 'Erro ao alterar o modo do fluxo' }
    } finally {
      setSaving(false)
    }
  }, [headers, fetchConfig])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  return {
    config,
    loading,
    saving,
    error,
    alterarModo,
    recarregar: fetchConfig,
  }
}
