import { useState, useEffect, useCallback, useMemo } from 'react'
import { Poste } from '../components/PosteForm/types'
import { useAuth } from '../contexts/AuthContext'
import { API_URL } from '../config/api'
import { useBairros, type Bairro } from './useBairros'

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
  ruaFiltro: string
  setRuaFiltro: (valor: string) => void
  ruasDisponiveis: string[]
  refetch: () => void
  excluir: (id: number) => Promise<boolean>
}

export function useAdminPostes(): UseAdminPostesResult {
  const { token } = useAuth()
  const { bairros } = useBairros()
  const [todosPostes, setTodosPostes] = useState<Poste[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [bairroFiltro, setBairroFiltro] = useState('')
  const [ruaFiltro, setRuaFiltro] = useState('')
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
    const nomesApi = bairros.map((b: Bairro) => b.nome)
    const nomesPostes = new Set<string>()
    for (const p of todosPostes) {
      const normalizado = normalizaBairro(p.bairro)
      if (normalizado !== BAIRRO_SEM_INFORMACAO) {
        nomesPostes.add(normalizado)
      }
    }
    const todos = new Set([...nomesApi, ...nomesPostes])
    return Array.from(todos).sort((a, b) => a.localeCompare(b))
  }, [bairros, todosPostes])

  const ruasDisponiveis = useMemo(() => {
    const nomes = new Set<string>()
    for (const p of todosPostes) {
      if (p.rua && p.rua.trim()) {
        nomes.add(p.rua.trim())
      }
    }
    return Array.from(nomes).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [todosPostes])

  const postesFiltrados = useMemo(() => {
    let resultado = todosPostes

    if (bairroFiltro) {
      resultado = resultado.filter((p) => normalizaBairro(p.bairro) === bairroFiltro)
    }

    if (ruaFiltro) {
      resultado = resultado.filter((p) => p.rua === ruaFiltro)
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
  }, [todosPostes, bairroFiltro, ruaFiltro, busca])

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
    ruaFiltro,
    setRuaFiltro,
    ruasDisponiveis,
    refetch: fetchPostes,
    excluir,
  }
}
