import { useState, useEffect, useCallback } from 'react'
import { Poste } from '../components/PosteForm/types'
import { useAuth } from '../contexts/AuthContext'
import { API_URL } from '../config/api'

interface UseAdminPostesResult {
  postes: Poste[]
  loading: boolean
  error: string | null
  busca: string
  setBusca: (valor: string) => void
  refetch: () => void
  excluir: (id: number) => Promise<boolean>
}

export function useAdminPostes(): UseAdminPostesResult {
  const { token } = useAuth()
  const [postes, setPostes] = useState<Poste[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const fetchPostes = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/postes`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error('Erro ao carregar postes')
      }

      const data = await response.json()
      setPostes(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao conectar com o servidor'
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchPostes()
  }, [fetchPostes])

  const postesFiltrados = busca
    ? postes.filter(
        (p) =>
          p.codigo.toLowerCase().includes(busca.toLowerCase()) ||
          (p.rua && p.rua.toLowerCase().includes(busca.toLowerCase())) ||
          (p.bairro && p.bairro.toLowerCase().includes(busca.toLowerCase())) ||
          (p.numero && p.numero.toLowerCase().includes(busca.toLowerCase())) ||
          (p.endereco && p.endereco.toLowerCase().includes(busca.toLowerCase()))
      )
    : postes

  const excluir = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const response = await fetch(`${API_URL}/api/postes/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status_ativo: false }),
        })

        if (!response.ok) {
          throw new Error('Erro ao excluir poste')
        }

        await fetchPostes()
        return true
      } catch {
        return false
      }
    },
    [token, fetchPostes]
  )

  return {
    postes: postesFiltrados,
    loading,
    error,
    busca,
    setBusca,
    refetch: fetchPostes,
    excluir,
  }
}
