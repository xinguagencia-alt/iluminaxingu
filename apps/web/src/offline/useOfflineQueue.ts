import { useCallback, useEffect, useState } from 'react'
import { listarSolicitacoesPendentes, excluirPendente } from './queue'
import type { EstadoSync, SolicitacaoPendente } from './types'
import { EVENTO_FILA_ALTERADA } from './types'
import {
  cancelarAgendamentoTentativa,
  inscreverEstadoSync,
  limparResultadosSync,
  obterEstadoSync,
  sincronizarFila,
} from './sync'

export function useOfflineQueue() {
  const [pendentes, setPendentes] = useState<SolicitacaoPendente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [estadoSync, setEstadoSync] = useState<EstadoSync>(obterEstadoSync)

  const atualizar = useCallback(async () => {
    try {
      const itens = await listarSolicitacoesPendentes()
      setPendentes(itens)
      setErro(null)
    } catch {
      setErro('Nao foi possivel ler as solicitacoes salvas neste aparelho')
    } finally {
      setCarregando(false)
    }
  }, [])

  const sincronizarAgora = useCallback(() => {
    void sincronizarFila({ forcar: true })
  }, [])

  const limparResultados = useCallback(() => {
    limparResultadosSync()
  }, [])

  useEffect(() => {
    atualizar()
    window.addEventListener(EVENTO_FILA_ALTERADA, atualizar)
    window.addEventListener('focus', atualizar)
    return () => {
      window.removeEventListener(EVENTO_FILA_ALTERADA, atualizar)
      window.removeEventListener('focus', atualizar)
    }
  }, [atualizar])

  useEffect(() => inscreverEstadoSync(setEstadoSync), [])

  useEffect(() => {
    const sincronizarSeOnline = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return
      void sincronizarFila()
    }

    const aoMudarVisibilidade = () => {
      if (document.visibilityState !== 'visible') return
      sincronizarSeOnline()
    }

    // Abrir o portal
    sincronizarSeOnline()

    // Voltar ao foco do portal / navegador / aba
    window.addEventListener('online', sincronizarSeOnline)
    window.addEventListener('focus', sincronizarSeOnline)
    document.addEventListener('visibilitychange', aoMudarVisibilidade)

    return () => {
      window.removeEventListener('online', sincronizarSeOnline)
      window.removeEventListener('focus', sincronizarSeOnline)
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
      cancelarAgendamentoTentativa()
    }
  }, [])

  const remover = useCallback(
    async (idLocal: string) => {
      await excluirPendente(idLocal)
      await atualizar()
    },
    [atualizar]
  )

  return {
    pendentes,
    total: pendentes.length,
    carregando,
    erro,
    remover,
    atualizar,
    sincronizando: estadoSync.sincronizando,
    progresso: estadoSync.progresso,
    resultados: estadoSync.resultados,
    errosSync: estadoSync.erros,
    proximaTentativaEm: estadoSync.proxima_tentativa_em,
    sincronizarAgora,
    limparResultados,
  }
}
