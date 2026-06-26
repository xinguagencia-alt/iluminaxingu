import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333'

export interface Equipe {
  id: number
  nome: string
  descricao: string | null
  responsavel: string | null
  ativo: boolean
  criado_em: string
}

interface UseEquipesResult {
  equipes: Equipe[]
  loading: boolean
  error: string | null
  refetch: () => void
  criar: (dados: { nome: string; descricao?: string; responsavel?: string }) => Promise<boolean>
  atualizar: (
    id: number,
    dados: { nome?: string; descricao?: string; responsavel?: string; ativo?: boolean }
  ) => Promise<boolean>
  excluir: (id: number) => Promise<boolean>
}

export function useEquipes(): UseEquipesResult {
  const { token } = useAuth()
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEquipes = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/equipes`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error('Erro ao carregar equipes')
      }

      const data = await response.json()
      setEquipes(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao conectar com o servidor'
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchEquipes()
  }, [fetchEquipes])

  const criar = useCallback(
    async (dados: { nome: string; descricao?: string; responsavel?: string }): Promise<boolean> => {
      try {
        const response = await fetch(`${API_URL}/api/equipes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(dados),
        })

        if (!response.ok) {
          throw new Error('Erro ao criar equipe')
        }

        await fetchEquipes()
        return true
      } catch {
        return false
      }
    },
    [token, fetchEquipes]
  )

  const atualizar = useCallback(
    async (
      id: number,
      dados: { nome?: string; descricao?: string; responsavel?: string; ativo?: boolean }
    ): Promise<boolean> => {
      try {
        const response = await fetch(`${API_URL}/api/equipes/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(dados),
        })

        if (!response.ok) {
          throw new Error('Erro ao atualizar equipe')
        }

        await fetchEquipes()
        return true
      } catch {
        return false
      }
    },
    [token, fetchEquipes]
  )

  const excluir = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const response = await fetch(`${API_URL}/api/equipes/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error('Erro ao excluir equipe')
        }

        await fetchEquipes()
        return true
      } catch {
        return false
      }
    },
    [token, fetchEquipes]
  )

  return {
    equipes,
    loading,
    error,
    refetch: fetchEquipes,
    criar,
    atualizar,
    excluir,
  }
}