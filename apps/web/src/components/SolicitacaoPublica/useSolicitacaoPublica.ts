import { useCallback, useState } from 'react'
import { SolicitacaoPublicaData } from './types'
import { API_URL } from '../../config/api'

interface UseSolicitacaoPublicaResult {
  data: SolicitacaoPublicaData | null
  loading: boolean
  error: string | null
  buscar: (protocolo: string) => void
  limpar: () => void
}

export function useSolicitacaoPublica(): UseSolicitacaoPublicaResult {
  const [data, setData] = useState<SolicitacaoPublicaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buscar = useCallback(async (protocolo: string) => {
    if (!protocolo.trim()) return

    setLoading(true)
    setError(null)
    setData(null)

    try {
      const response = await fetch(
        `${API_URL}/api/solicitacoes/publica/${encodeURIComponent(protocolo.trim())}`
      )

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Solicitacao nao encontrada para este protocolo')
        }
        throw new Error('Erro ao consultar solicitacao')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar com o servidor')
    } finally {
      setLoading(false)
    }
  }, [])

  const limpar = useCallback(() => {
    setData(null)
    setError(null)
  }, [])

  return { data, loading, error, buscar, limpar }
}
