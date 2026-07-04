import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../config/api'
import { useAuth } from '../contexts/AuthContext'

export interface Bairro {
  id: number
  nome: string
  cor: string | null
}

interface UseBairrosResult {
  bairros: Bairro[]
  loading: boolean
  error: string | null
  refetch: () => void
  criarBairro: (nome: string, cor?: string) => Promise<{ ok: boolean; erro?: string }>
  excluirBairro: (id: number) => Promise<{ ok: boolean; erro?: string }>
}

export function useBairros(): UseBairrosResult {
  const { token } = useAuth()
  const [bairros, setBairros] = useState<Bairro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBairros = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/bairros`)
      if (!response.ok) throw new Error('Erro ao carregar bairros')
      const data = await response.json()
      setBairros(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao conectar com o servidor'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBairros()
  }, [fetchBairros])

  const criarBairro = useCallback(
    async (nome: string, cor?: string): Promise<{ ok: boolean; erro?: string }> => {
      try {
        const response = await fetch(`${API_URL}/api/bairros`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ nome, cor: cor || null }),
        })

        const data = await response.json()

        if (!response.ok) {
          return { ok: false, erro: data.error || 'Erro ao cadastrar bairro' }
        }

        setBairros((prev) => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
        return { ok: true }
      } catch {
        return { ok: false, erro: 'Erro ao conectar com o servidor' }
      }
    },
    [token]
  )

  const excluirBairro = useCallback(
    async (id: number): Promise<{ ok: boolean; erro?: string }> => {
      try {
        const response = await fetch(`${API_URL}/api/bairros/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const data = await response.json()

        if (!response.ok) {
          return { ok: false, erro: data.error || 'Erro ao excluir bairro' }
        }

        setBairros((prev) => prev.filter((b) => b.id !== id))
        return { ok: true }
      } catch {
        return { ok: false, erro: 'Erro ao conectar com o servidor' }
      }
    },
    [token]
  )

  return {
    bairros,
    loading,
    error,
    refetch: fetchBairros,
    criarBairro,
    excluirBairro,
  }
}
