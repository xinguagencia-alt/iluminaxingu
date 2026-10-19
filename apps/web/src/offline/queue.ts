import { salvarPendente, listarPendentes, removerPendente, contarPendentes } from './db'
import type { AnexoPendente, SolicitacaoPayload, SolicitacaoPendente } from './types'
import { EVENTO_FILA_ALTERADA } from './types'

function gerarIdLocal(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function notificarFilaAlterada(): void {
  window.dispatchEvent(new CustomEvent(EVENTO_FILA_ALTERADA))
}

export interface ResultadoEnfileiramento {
  id_local: string
  anexos_salvos: number
  anexos_descartados: boolean
}

export async function enfileirarSolicitacao(
  payload: SolicitacaoPayload,
  arquivos: File[]
): Promise<ResultadoEnfileiramento> {
  const idLocal = gerarIdLocal()

  const anexos: AnexoPendente[] = []
  let anexosDescartados = false

  for (const arquivo of arquivos) {
    try {
      anexos.push({
        nome: arquivo.name,
        tipo: arquivo.type,
        tamanho: arquivo.size,
        blob: arquivo,
      })
      const itemParcial: SolicitacaoPendente = {
        id_local: idLocal,
        payload,
        anexos: [...anexos],
        anexos_descartados: false,
        estado: 'pendente',
        criado_em: Date.now(),
        protocolo_oficial: null,
      }
      await salvarPendente(itemParcial)
    } catch {
      anexosDescartados = true
      anexos.length = 0
      break
    }
  }

  const item: SolicitacaoPendente = {
    id_local: idLocal,
    payload,
    anexos,
    anexos_descartados: anexosDescartados,
    estado: 'pendente',
    criado_em: Date.now(),
    protocolo_oficial: null,
  }

  await salvarPendente(item)
  notificarFilaAlterada()

  return {
    id_local: idLocal,
    anexos_salvos: anexos.length,
    anexos_descartados: anexosDescartados,
  }
}

export async function listarSolicitacoesPendentes(): Promise<SolicitacaoPendente[]> {
  return listarPendentes()
}

export async function excluirPendente(idLocal: string): Promise<void> {
  await removerPendente(idLocal)
  notificarFilaAlterada()
}

export async function totalPendentes(): Promise<number> {
  return contarPendentes()
}
