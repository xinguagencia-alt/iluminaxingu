import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { API_URL } from '../config/api'

export interface ItemEstoque {
  id: number
  nome: string
  categoria: string
  unidade_medida: string
  estoque_minimo: number
  estoque_atual: number
  ativo: boolean
  observacao: string | null
  codigo_interno: string | null
  criado_em: string
}

export interface MovimentacaoEstoque {
  id: number
  item_id: number
  item_nome: string
  unidade_medida: string
  item_categoria: string
  tipo: string
  quantidade: number
  saldo_anterior: number
  saldo_posterior: number
  observacao: string | null
  os_id: number | null
  nota_fiscal: string | null
  fornecedor: string | null
  usuario: string | null
  data_movimento: string
  criado_em: string
}

export interface ItemUsadoOS {
  id: number
  os_id: number
  item_id: number
  item_nome: string
  unidade_medida: string
  item_categoria: string
  quantidade: number
  usuario: string | null
  observacao: string | null
  criado_em: string
}

interface ToggleResult {
  ok: boolean
  error?: string
}

interface UseEstoqueResult {
  config: Record<string, string>
  itens: ItemEstoque[]
  movimentacoes: MovimentacaoEstoque[]
  itensUsados: ItemUsadoOS[]
  loading: boolean
  error: string | null
  refetchConfig: () => void
  refetchItens: () => void
  refetchMovimentacoes: () => void
  refetchItensUsados: () => void
  toggleEstoque: (ativo: boolean) => Promise<ToggleResult>
  criarItem: (dados: Partial<ItemEstoque>) => Promise<boolean>
  atualizarItem: (id: number, dados: Partial<ItemEstoque>) => Promise<boolean>
  excluirItem: (id: number) => Promise<boolean>
  criarMovimentacao: (dados: { item_id: number; tipo: string; quantidade: number; observacao?: string; os_id?: number; nota_fiscal?: string; fornecedor?: string; data_movimento?: string }) => Promise<boolean>
  registrarItensUsados: (dados: { os_id: number; item_id: number; quantidade: number; observacao?: string }) => Promise<boolean>
}

export function useEstoque(): UseEstoqueResult {
  const { token } = useAuth()
  const [config, setConfig] = useState<Record<string, string>>({})
  const [itens, setItens] = useState<ItemEstoque[]>([])
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>([])
  const [itensUsados, setItensUsados] = useState<ItemUsadoOS[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token])

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/estoque/config`, { headers: headers() })
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
      }
    } catch { /* ignore */ }
  }, [headers])

  const fetchItens = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/estoque/itens`, { headers: headers() })
      if (response.ok) {
        const data = await response.json()
        setItens(data)
      }
    } catch { /* ignore */ }
  }, [headers])

  const fetchMovimentacoes = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/estoque/movimentacoes?limit=200`, { headers: headers() })
      if (response.ok) {
        const data = await response.json()
        setMovimentacoes(data)
      }
    } catch { /* ignore */ }
  }, [headers])

  const fetchItensUsados = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/estoque/itens-usados-os`, { headers: headers() })
      if (response.ok) {
        const data = await response.json()
        setItensUsados(data)
      }
    } catch { /* ignore */ }
  }, [headers])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([fetchConfig(), fetchItens(), fetchMovimentacoes(), fetchItensUsados()])
    } catch {
      setError('Erro ao carregar dados do estoque')
    } finally {
      setLoading(false)
    }
  }, [fetchConfig, fetchItens, fetchMovimentacoes, fetchItensUsados])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const toggleEstoque = useCallback(async (ativo: boolean): Promise<ToggleResult> => {
    try {
      const response = await fetch(`${API_URL}/api/estoque/config`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ chave: 'estoque_ativo', valor: ativo ? 'true' : 'false' }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        const msg = (body && body.error) || `Erro HTTP ${response.status}`
        return { ok: false, error: msg }
      }
      if (body && body.config) {
        setConfig(body.config)
      } else {
        await fetchConfig()
      }
      return { ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha de conexao com o servidor'
      return { ok: false, error: msg }
    }
  }, [headers, fetchConfig])

  const criarItem = useCallback(async (dados: Partial<ItemEstoque>): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/estoque/itens`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(dados),
      })
      if (!response.ok) return false
      await fetchItens()
      return true
    } catch {
      return false
    }
  }, [headers, fetchItens])

  const atualizarItem = useCallback(async (id: number, dados: Partial<ItemEstoque>): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/estoque/itens/${id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(dados),
      })
      if (!response.ok) return false
      await fetchItens()
      return true
    } catch {
      return false
    }
  }, [headers, fetchItens])

  const excluirItem = useCallback(async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/estoque/itens/${id}`, {
        method: 'DELETE',
        headers: headers(),
      })
      if (!response.ok) return false
      await fetchItens()
      return true
    } catch {
      return false
    }
  }, [headers, fetchItens])

  const criarMovimentacao = useCallback(async (dados: { item_id: number; tipo: string; quantidade: number; observacao?: string; os_id?: number; nota_fiscal?: string; fornecedor?: string; data_movimento?: string }): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/estoque/movimentacoes`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(dados),
      })
      if (!response.ok) return false
      await Promise.all([fetchItens(), fetchMovimentacoes()])
      return true
    } catch {
      return false
    }
  }, [headers, fetchItens, fetchMovimentacoes])

  const registrarItensUsados = useCallback(async (dados: { os_id: number; item_id: number; quantidade: number; observacao?: string }): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/estoque/itens-usados-os`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(dados),
      })
      if (!response.ok) return false
      await fetchItensUsados()
      return true
    } catch {
      return false
    }
  }, [headers, fetchItensUsados])

  return {
    config,
    itens,
    movimentacoes,
    itensUsados,
    loading,
    error,
    refetchConfig: fetchConfig,
    refetchItens: fetchItens,
    refetchMovimentacoes: fetchMovimentacoes,
    refetchItensUsados: fetchItensUsados,
    toggleEstoque,
    criarItem,
    atualizarItem,
    excluirItem,
    criarMovimentacao,
    registrarItensUsados,
  }
}
