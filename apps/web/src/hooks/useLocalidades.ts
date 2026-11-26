import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../config/api'
import { useAuth } from '../contexts/AuthContext'

export interface Localidade {
  id: number
  nome: string
  tipo: 'sede' | 'distrito' | 'vila'
  ativo: boolean
  criado_em: string
}

interface UseLocalidadesResult {
  localidades: Localidade[]
  loading: boolean
  error: string | null
  indisponivel: boolean
  refetch: () => void
  criarLocalidade: (nome: string, tipo: 'distrito' | 'vila') => Promise<{ ok: boolean; erro?: string }>
  atualizarLocalidade: (id: number, dados: { nome?: string; tipo?: 'distrito' | 'vila'; ativo?: boolean }) => Promise<{ ok: boolean; erro?: string }>
  desativarLocalidade: (id: number) => Promise<{ ok: boolean; erro?: string }>
}

export function useLocalidades(): UseLocalidadesResult {
  const { token } = useAuth()
  const [localidades, setLocalidades] = useState<Localidade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [indisponivel, setIndisponivel] = useState(false)

  const fetchLocalidades = useCallback(async () => {
    setLoading(true)
    setError(null)
    setIndisponivel(false)

    try {
      const [distritosRes, vilasRes] = await Promise.all([
        fetch(`${API_URL}/api/localidades?tipo=distrito`),
        fetch(`${API_URL}/api/localidades?tipo=vila`),
      ])

      if (!distritosRes.ok || !vilasRes.ok) throw new Error('Erro ao carregar localidades')

      const [distritos, vilas] = await Promise.all([
        distritosRes.json(),
        vilasRes.json(),
      ])

      const todas = [...distritos, ...vilas].sort((a, b) => {
        if (a.tipo !== b.tipo) return a.tipo === 'distrito' ? -1 : 1
        return a.nome.localeCompare(b.nome, 'pt-BR')
      })

      setLocalidades(todas)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar com o servidor')
      setIndisponivel(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLocalidades()
  }, [fetchLocalidades])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchLocalidades()
      }
    }
    const handleFocus = () => {
      fetchLocalidades()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [fetchLocalidades])

  const criarLocalidade = useCallback(
    async (nome: string, tipo: 'distrito' | 'vila'): Promise<{ ok: boolean; erro?: string }> => {
      try {
        const response = await fetch(`${API_URL}/api/localidades`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ nome, tipo }),
        })

        const data = await response.json()

        if (!response.ok) {
          return { ok: false, erro: data.error || 'Erro ao cadastrar localidade' }
        }

        setLocalidades((prev) => [...prev, data].sort((a, b) => {
          if (a.tipo !== b.tipo) return a.tipo === 'distrito' ? -1 : 1
          return a.nome.localeCompare(b.nome, 'pt-BR')
        }))
        return { ok: true }
      } catch {
        return { ok: false, erro: 'Erro ao conectar com o servidor' }
      }
    },
    [token]
  )

  const atualizarLocalidade = useCallback(
    async (id: number, dados: { nome?: string; tipo?: 'distrito' | 'vila'; ativo?: boolean }): Promise<{ ok: boolean; erro?: string }> => {
      try {
        const response = await fetch(`${API_URL}/api/localidades/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(dados),
        })

        const data = await response.json()

        if (!response.ok) {
          return { ok: false, erro: data.error || 'Erro ao atualizar localidade' }
        }

        setLocalidades((prev) => prev.map((l) => (l.id === id ? data : l)).sort((a, b) => {
          if (a.tipo !== b.tipo) return a.tipo === 'distrito' ? -1 : 1
          return a.nome.localeCompare(b.nome, 'pt-BR')
        }))
        return { ok: true }
      } catch {
        return { ok: false, erro: 'Erro ao conectar com o servidor' }
      }
    },
    [token]
  )

  const desativarLocalidade = useCallback(
    async (id: number): Promise<{ ok: boolean; erro?: string }> => {
      try {
        const response = await fetch(`${API_URL}/api/localidades/${id}/desativar`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const data = await response.json()

        if (!response.ok) {
          return { ok: false, erro: data.error || 'Erro ao desativar localidade' }
        }

        setLocalidades((prev) => prev.map((l) => (l.id === id ? { ...l, ativo: false } : l)))
        return { ok: true }
      } catch {
        return { ok: false, erro: 'Erro ao conectar com o servidor' }
      }
    },
    [token]
  )

  return {
    localidades,
    loading,
    error,
    indisponivel,
    refetch: fetchLocalidades,
    criarLocalidade,
    atualizarLocalidade,
    desativarLocalidade,
  }
}