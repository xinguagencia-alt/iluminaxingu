import { useCallback, useEffect, useState } from 'react'
import { API_URL } from '../config/api'
import { useAuth } from '../contexts/AuthContext'
import { normalizarCatalogoLocalidades, type Localidade, type TipoLocalidade } from '../localidades'

interface ResultadoOperacao {
  ok: boolean
  error?: string
}

interface ErroApi {
  error?: string
  detalhe?: string
}

async function mensagemErro(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as ErroApi | null
  if (response.status === 503) {
    return body?.detalhe || 'O cadastro de localidades ainda não está disponível. A migration precisa ser aplicada antes de usar este recurso.'
  }
  return body?.error || `Não foi possível concluir a operação (HTTP ${response.status}).`
}

export function useAdminLocalidades() {
  const { token } = useAuth()
  const [localidades, setLocalidades] = useState<Localidade[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/api/localidades`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error(await mensagemErro(response))
      const data: unknown = await response.json()
      setLocalidades(normalizarCatalogoLocalidades(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar localidades.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        recarregar()
      }
    }
    const handleFocus = () => {
      recarregar()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [recarregar])

  const operar = useCallback(async (
    url: string,
    method: 'POST' | 'PUT' | 'PATCH',
    body?: Record<string, unknown>
  ): Promise<ResultadoOperacao> => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}${url}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      if (!response.ok) return { ok: false, error: await mensagemErro(response) }
      await recarregar()
      return { ok: true }
    } catch {
      return { ok: false, error: 'Falha de conexão. Verifique a internet e tente novamente.' }
    } finally {
      setSaving(false)
    }
  }, [token, recarregar])

  const criar = useCallback((nome: string, tipo: TipoLocalidade) =>
    operar('/api/localidades', 'POST', { nome, tipo }), [operar])

  const atualizar = useCallback((id: number, nome: string, tipo: TipoLocalidade) =>
    operar(`/api/localidades/${id}`, 'PUT', { nome, tipo }), [operar])

  const desativar = useCallback((id: number) =>
    operar(`/api/localidades/${id}/desativar`, 'PATCH'), [operar])

  return { localidades, loading, saving, error, recarregar, criar, atualizar, desativar }
}