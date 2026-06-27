import { useState, useEffect, useCallback, useMemo } from 'react'
import { API_URL } from '../config/api'
import { useAuth } from '../contexts/AuthContext'

export interface Rua {
  id: number
  nome: string
  tipo: 'avenida' | 'rua'
}

interface UseRuasResult {
  avenidas: Rua[]
  ruas: Rua[]
  loading: boolean
  error: string | null
  refetch: () => void
  criarRua: (nome: string, tipo: 'avenida' | 'rua') => Promise<{ ok: boolean; erro?: string }>
  excluirRua: (id: number) => Promise<{ ok: boolean; erro?: string }>
}

export function useRuas(): UseRuasResult {
  const { token } = useAuth()
  const [todasRuas, setTodasRuas] = useState<Rua[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRuas = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/ruas`)
      if (!response.ok) throw new Error('Erro ao carregar ruas')
      const data = await response.json()
      setTodasRuas(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao conectar com o servidor'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRuas()
  }, [fetchRuas])

  const avenidas = useMemo(
    () => todasRuas.filter((r) => r.tipo === 'avenida').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [todasRuas]
  )

  const ruas = useMemo(
    () => todasRuas.filter((r) => r.tipo === 'rua').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [todasRuas]
  )

  const criarRua = useCallback(
    async (nome: string, tipo: 'avenida' | 'rua'): Promise<{ ok: boolean; erro?: string }> => {
      try {
        const response = await fetch(`${API_URL}/api/ruas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ nome, tipo }),
        })

        const data = await response.json()

        if (!response.ok) {
          return { ok: false, erro: data.error || 'Erro ao cadastrar rua/avenida' }
        }

        setTodasRuas((prev) => [...prev, data].sort((a, b) => {
          if (a.tipo !== b.tipo) return a.tipo === 'avenida' ? -1 : 1
          return a.nome.localeCompare(b.nome, 'pt-BR')
        }))
        return { ok: true }
      } catch {
        return { ok: false, erro: 'Erro ao conectar com o servidor' }
      }
    },
    [token]
  )

  const excluirRua = useCallback(
    async (id: number): Promise<{ ok: boolean; erro?: string }> => {
      try {
        const response = await fetch(`${API_URL}/api/ruas/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const data = await response.json()

        if (!response.ok) {
          return { ok: false, erro: data.error || 'Erro ao excluir rua/avenida' }
        }

        setTodasRuas((prev) => prev.filter((r) => r.id !== id))
        return { ok: true }
      } catch {
        return { ok: false, erro: 'Erro ao conectar com o servidor' }
      }
    },
    [token]
  )

  return {
    avenidas,
    ruas,
    loading,
    error,
    refetch: fetchRuas,
    criarRua,
    excluirRua,
  }
}
