import { useState, useEffect, useCallback, useMemo } from 'react'
import { Poste } from '../components/PosteForm/types'
import { useAuth } from '../contexts/AuthContext'
import { API_URL } from '../config/api'

interface UseAdminPostesResult {
  postes: Poste[]
  todosPostes: Poste[]
  loading: boolean
  error: string | null
  busca: string
  setBusca: (valor: string) => void
  bairroFiltro: string
  setBairroFiltro: (valor: string) => void
  bairrosDisponiveis: string[]
  refetch: () => void
  excluir: (id: number) => Promise<boolean>
}

export function useAdminPostes(): UseAdminPostesResult {
  const { token } = useAuth()
  const [todosPostes, setTodosPostes] = useState<Poste[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [bairroFiltro, setBairroFiltro] = useState('')
  const BAIRRO_SEM_INFORMACAO = 'Sem bairro informado'

  function normalizaBairro(bairro?: string | null) {
    const valor = bairro?.trim()
    return valor ? valor : BAIRRO_SEM_INFORMACAO
  }

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
      setTodosPostes(data)
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

  const bairrosDisponiveis = useMemo(() => {
    const set = new Set<string>()
    for (const p of todosPostes) {
      set.add(normalizaBairro(p.bairro))
    }
    return Array.from(set).sort()
  }, [todosPostes])

  const postesFiltrados = useMemo(() => {
    let resultado = todosPostes

    if (bairroFiltro) {
      resultado = resultado.filter((p) => normalizaBairro(p.bairro) === bairroFiltro)
    }

    if (busca) {
      const termo = busca.toLowerCase()
      resultado = resultado.filter(
        (p) =>
          p.codigo.toLowerCase().includes(termo) ||
          (p.rua && p.rua.toLowerCase().includes(termo)) ||
          (p.bairro && p.bairro.toLowerCase().includes(termo)) ||
          (p.numero && p.numero.toLowerCase().includes(termo)) ||
          (p.endereco && p.endereco.toLowerCase().includes(termo))
      )
    }

    return resultado
  }, [todosPostes, bairroFiltro, busca])

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
    todosPostes,
    loading,
    error,
    busca,
    setBusca,
    bairroFiltro,
    setBairroFiltro,
    bairrosDisponiveis,
    refetch: fetchPostes,
    excluir,
  }
}
