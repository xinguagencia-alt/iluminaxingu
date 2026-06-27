import { useState, useCallback } from 'react'
import { API_URL } from '../config/api'
import { useAuth } from '../contexts/AuthContext'

interface ExportSummary {
  postes: number
  bairros: number
  ruas: number
  solicitacoes: number
  ordens_servico: number
  equipes: number
}

interface ExportResult {
  tabela: string
  exportadoEm: string
  total: number
  dados: unknown[]
}

interface UseExportResult {
  summary: ExportSummary | null
  loadingSummary: boolean
  exportando: boolean
  error: string | null
  fetchSummary: () => Promise<void>
  exportar: (tabela: string) => Promise<boolean>
}

export function useExport(): UseExportResult {
  const { token } = useAuth()
  const [summary, setSummary] = useState<ExportSummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true)
    try {
      const response = await fetch(`${API_URL}/api/export`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Erro ao carregar resumo')
      const data = await response.json()
      setSummary(data)
    } catch {
      setError('Erro ao carregar resumo de dados')
    } finally {
      setLoadingSummary(false)
    }
  }, [token])

  const exportar = useCallback(
    async (tabela: string): Promise<boolean> => {
      setExportando(true)
      setError(null)
      try {
        const response = await fetch(`${API_URL}/api/export/${tabela}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) throw new Error('Erro ao exportar dados')

        const data: ExportResult = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${tabela}_${new Date().toISOString().slice(0, 10)}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        return true
      } catch {
        setError('Erro ao exportar dados')
        return false
      } finally {
        setExportando(false)
      }
    },
    [token]
  )

  return {
    summary,
    loadingSummary,
    exportando,
    error,
    fetchSummary,
    exportar,
  }
}
