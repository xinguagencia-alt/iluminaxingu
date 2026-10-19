import { API_URL } from '../config/api'
import { listarPendentes, salvarPendente, removerPendente } from './db'
import type {
  ErroSync,
  EstadoSync,
  ResultadoProtocolo,
  SolicitacaoPendente,
} from './types'
import { EVENTO_FILA_ALTERADA } from './types'

const TIMEOUT_SOLICITACAO_MS = 20000
const TIMEOUT_ANEXO_MS = 30000
const BACKOFF_INICIAL_MS = 15000
const BACKOFF_MAXIMO_MS = 10 * 60 * 1000

export interface ResultadoSync {
  protocolos: ResultadoProtocolo[]
  erros: ErroSync[]
}

interface ResultadoEnvio {
  ok: boolean
  mensagem: string
  retryavel: boolean
  aguardar_ms?: number
}

interface ResultadoCriacao extends ResultadoEnvio {
  id?: number
  protocolo?: string
}

const ESTADO_INICIAL: EstadoSync = {
  sincronizando: false,
  progresso: null,
  resultados: [],
  erros: [],
  proxima_tentativa_em: null,
}

let estadoSync: EstadoSync = { ...ESTADO_INICIAL }
const ouvintesEstado = new Set<(estado: EstadoSync) => void>()

let emAndamento = false
let timerTentativa: ReturnType<typeof setTimeout> | null = null

export function obterEstadoSync(): EstadoSync {
  return estadoSync
}

export function inscreverEstadoSync(
  ouvinte: (estado: EstadoSync) => void
): () => void {
  ouvintesEstado.add(ouvinte)
  return () => {
    ouvintesEstado.delete(ouvinte)
  }
}

function publicarEstado(parcial: Partial<EstadoSync>): void {
  estadoSync = { ...estadoSync, ...parcial }
  ouvintesEstado.forEach((ouvinte) => ouvinte(estadoSync))
}

export function limparResultadosSync(): void {
  publicarEstado({ resultados: [], erros: [] })
}

export function cancelarAgendamentoTentativa(): void {
  if (timerTentativa) {
    clearTimeout(timerTentativa)
    timerTentativa = null
  }
}

function notificarFilaAlterada(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(EVENTO_FILA_ALTERADA))
  }
}

function calcularBackoff(tentativas: number): number {
  const expoente = Math.min(Math.max(tentativas - 1, 0), 10)
  return Math.min(BACKOFF_INICIAL_MS * 2 ** expoente, BACKOFF_MAXIMO_MS)
}

function classificarFalhaDeRede(erro: unknown): string {
  if (erro instanceof Error && erro.name === 'AbortError') {
    return 'Tempo esgotado ao enviar. Verifique a conexao e tente novamente.'
  }
  return 'Sem conexao com o servidor. A solicitacao continua salva neste aparelho.'
}

async function fetchComTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function lerCorpoErro(response: Response): Promise<{
  error?: string
  detail?: string
}> {
  try {
    const corpo: unknown = await response.json()
    if (corpo && typeof corpo === 'object') {
      const { error, detail } = corpo as { error?: unknown; detail?: unknown }
      return {
        error: typeof error === 'string' ? error : undefined,
        detail: typeof detail === 'string' ? detail : undefined,
      }
    }
  } catch {
    /* corpo nao JSON (ex.: pagina de erro de proxy) */
  }
  return {}
}

function retryAfterMs(response: Response): number | undefined {
  const header = response.headers?.get?.('retry-after')
  if (!header) return undefined
  const segundos = Number.parseInt(header, 10)
  if (Number.isFinite(segundos) && segundos >= 0) return segundos * 1000
  return undefined
}

function ehErroDeSchema(mensagem: string): boolean {
  return (
    /client_request_id/i.test(mensagem) ||
    /column\s+".*"\s+does not exist/i.test(mensagem) ||
    /relation\s+".*"\s+does not exist/i.test(mensagem)
  )
}

async function salvarItem(
  item: SolicitacaoPendente,
  parcial: Partial<SolicitacaoPendente>
): Promise<SolicitacaoPendente> {
  const atualizado: SolicitacaoPendente = {
    ...item,
    ...parcial,
    atualizado_em: Date.now(),
  }
  await salvarPendente(atualizado)
  notificarFilaAlterada()
  return atualizado
}

async function registrarFalha(
  item: SolicitacaoPendente,
  mensagem: string,
  retryavel: boolean,
  aguardarMs?: number
): Promise<SolicitacaoPendente> {
  const tentativas = (item.tentativas ?? 0) + 1
  const proximaTentativaEm = retryavel
    ? Date.now() + (aguardarMs ?? calcularBackoff(tentativas))
    : null

  return salvarItem(item, {
    estado: 'erro',
    ultimo_erro: mensagem,
    erro_retryavel: retryavel,
    tentativas,
    proxima_tentativa_em: proximaTentativaEm,
  })
}

async function enviarSolicitacao(item: SolicitacaoPendente): Promise<ResultadoCriacao> {
  let response: Response
  try {
    response = await fetchComTimeout(
      `${API_URL}/api/solicitacoes`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item.payload,
          client_request_id: item.id_local,
        }),
      },
      TIMEOUT_SOLICITACAO_MS
    )
  } catch (erro) {
    return {
      ok: false,
      retryavel: true,
      mensagem: classificarFalhaDeRede(erro),
    }
  }

  if (response.status === 200 || response.status === 201) {
    let dados: unknown
    try {
      dados = await response.json()
    } catch {
      return {
        ok: false,
        retryavel: true,
        mensagem: 'Resposta inesperada do servidor. Enviaremos novamente.',
      }
    }
    const corpo = (dados ?? {}) as { id?: unknown; protocolo?: unknown }
    if (typeof corpo.id !== 'number' || typeof corpo.protocolo !== 'string') {
      return {
        ok: false,
        retryavel: false,
        mensagem:
          'O servidor respondeu sem o protocolo esperado. Verifique se a API esta atualizada e use Sincronizar agora.',
      }
    }
    return {
      ok: true,
      retryavel: false,
      mensagem: '',
      id: corpo.id,
      protocolo: corpo.protocolo,
    }
  }

  const corpo = await lerCorpoErro(response)
  const mensagemServidor = corpo.error || corpo.detail || ''

  if (response.status === 429) {
    return {
      ok: false,
      retryavel: true,
      mensagem:
        mensagemServidor ||
        'Muitas solicitacoes enviadas. A nova tentativa sera reagendada.',
      aguardar_ms: retryAfterMs(response),
    }
  }

  if (response.status >= 500) {
    const mensagemCompleta = `${mensagemServidor} ${corpo.detail || ''}`.trim()
    if (ehErroDeSchema(mensagemCompleta)) {
      return {
        ok: false,
        retryavel: false,
        mensagem:
          'O servidor ainda nao suporta a sincronizacao (coluna client_request_id ausente). A solicitacao foi mantida neste aparelho; atualize a API e use Sincronizar agora.',
      }
    }
    return {
      ok: false,
      retryavel: true,
      mensagem:
        mensagemServidor ||
        `Erro temporario no servidor (HTTP ${response.status}).`,
    }
  }

  return {
    ok: false,
    retryavel: false,
    mensagem:
      mensagemServidor ||
      `O servidor recusou o envio (HTTP ${response.status}).`,
  }
}

async function enviarAnexo(
  item: SolicitacaoPendente,
  indice: number
): Promise<ResultadoEnvio> {
  const anexo = item.anexos[indice]

  if (!anexo) {
    return {
      ok: false,
      retryavel: false,
      mensagem: 'Registro do anexo ausente neste aparelho.',
    }
  }

  if (!anexo.blob) {
    return {
      ok: false,
      retryavel: false,
      mensagem: 'Arquivo local indisponivel.',
    }
  }

  let response: Response
  try {
    const formData = new FormData()
    formData.append('arquivo', anexo.blob, anexo.nome)
    formData.append('solicitacao_id', String(item.solicitacao_id))
    formData.append('protocolo', String(item.protocolo_oficial))

    response = await fetchComTimeout(
      `${API_URL}/api/anexos/upload-public`,
      { method: 'POST', body: formData },
      TIMEOUT_ANEXO_MS
    )
  } catch (erro) {
    return {
      ok: false,
      retryavel: true,
      mensagem: classificarFalhaDeRede(erro),
    }
  }

  if (response.ok) {
    return { ok: true, retryavel: false, mensagem: '' }
  }

  const corpo = await lerCorpoErro(response)
  const mensagemServidor = corpo.error || `HTTP ${response.status}`

  if (response.status === 429 || response.status >= 500) {
    return {
      ok: false,
      retryavel: true,
      mensagem: mensagemServidor,
      aguardar_ms: response.status === 429 ? retryAfterMs(response) : undefined,
    }
  }

  return { ok: false, retryavel: false, mensagem: mensagemServidor }
}

async function processarItem(
  item: SolicitacaoPendente,
  resultado: ResultadoSync
): Promise<void> {
  let atual = item
  const nome = atual.payload?.nome_solicitante || 'solicitacao'

  if (!atual.id_local || !String(atual.id_local).trim()) {
    const mensagem =
      'Identificador local (client_request_id) indisponivel. A solicitacao foi mantida neste aparelho.'
    await registrarFalha(atual, mensagem, false)
    resultado.erros.push({ id_local: atual.id_local || '', nome, mensagem })
    return
  }

  atual = await salvarItem(atual, {
    estado: 'enviando',
    ultimo_erro: null,
    proxima_tentativa_em: null,
  })

  // 1) Criar (ou recuperar, por idempotencia) a solicitacao no servidor
  if (!atual.protocolo_oficial || !atual.solicitacao_id) {
    const envio = await enviarSolicitacao(atual)

    if (!envio.ok) {
      await registrarFalha(atual, envio.mensagem, envio.retryavel, envio.aguardar_ms)
      resultado.erros.push({ id_local: atual.id_local, nome, mensagem: envio.mensagem })
      return
    }

    atual = await salvarItem(atual, {
      protocolo_oficial: envio.protocolo ?? null,
      solicitacao_id: envio.id,
      tentativas: 0,
      proxima_tentativa_em: null,
      ultimo_erro: null,
    })
  }

  // 2) Enviar anexos pendentes, um por vez
  const enviados = new Set(atual.anexos_enviados ?? [])
  for (let indice = 0; indice < atual.anexos.length; indice++) {
    if (enviados.has(indice)) continue

    const anexo = atual.anexos[indice]
    const envio = await enviarAnexo(atual, indice)

    if (!envio.ok) {
      const mensagem = `Anexo "${anexo.nome}": ${envio.mensagem}`
      await registrarFalha(atual, mensagem, envio.retryavel, envio.aguardar_ms)
      resultado.erros.push({ id_local: atual.id_local, nome, mensagem })
      return
    }

    enviados.add(indice)
    atual = await salvarItem(atual, { anexos_enviados: [...enviados].sort((a, b) => a - b) })
  }

  // 3) Confirmacao completa: gravar estado final e retirar da fila
  atual = await salvarItem(atual, {
    estado: 'enviada',
    ultimo_erro: null,
    erro_retryavel: undefined,
    proxima_tentativa_em: null,
    tentativas: 0,
  })

  await removerPendente(atual.id_local)
  notificarFilaAlterada()

  const protocolo = atual.protocolo_oficial
  if (protocolo) {
    const novoResultado: ResultadoProtocolo = { protocolo, nome }
    resultado.protocolos.push(novoResultado)
    publicarEstado({ resultados: [...estadoSync.resultados, novoResultado] })
  }
}

async function reagendarTentativa(): Promise<void> {
  cancelarAgendamentoTentativa()

  try {
    const itens = await listarPendentes()
    const proximas = itens
      .filter(
        (item) =>
          item.estado === 'erro' &&
          item.erro_retryavel !== false &&
          typeof item.proxima_tentativa_em === 'number'
      )
      .map((item) => item.proxima_tentativa_em as number)

    if (proximas.length === 0) {
      publicarEstado({ proxima_tentativa_em: null })
      return
    }

    const maisProxima = Math.min(...proximas)
    publicarEstado({ proxima_tentativa_em: maisProxima })

    const atraso = Math.max(maisProxima - Date.now(), 500)
    timerTentativa = setTimeout(() => {
      timerTentativa = null
      void sincronizarFila()
    }, atraso)
  } catch {
    publicarEstado({ proxima_tentativa_em: null })
  }
}

export async function sincronizarFila(
  opcoes: { forcar?: boolean } = {}
): Promise<ResultadoSync | null> {
  if (emAndamento) return null

  emAndamento = true
  cancelarAgendamentoTentativa()

  const resultado: ResultadoSync = { protocolos: [], erros: [] }
  const errosDaExecucao: ErroSync[] = []

  publicarEstado({
    sincronizando: true,
    progresso: { atual: 0, total: 0 },
    erros: [],
  })

  try {
    // FIFO: ordenado por criado_em dentro de listarPendentes()
    const itens = await listarPendentes()
    const agora = Date.now()
    const elegiveis: SolicitacaoPendente[] = []

    for (const item of itens) {
      if (item.estado === 'enviada') {
        // Confirmado em execucao anterior; so faltava sair da fila
        await removerPendente(item.id_local)
        notificarFilaAlterada()
        continue
      }

      if (item.estado === 'erro') {
        const naoRetryavel = item.erro_retryavel === false
        if (naoRetryavel && !opcoes.forcar) continue
        if (
          !opcoes.forcar &&
          typeof item.proxima_tentativa_em === 'number' &&
          item.proxima_tentativa_em > agora
        ) {
          continue
        }
      }

      elegiveis.push(item)
    }

    publicarEstado({ progresso: { atual: 0, total: elegiveis.length } })

    let numero = 0
    for (const item of elegiveis) {
      numero += 1
      publicarEstado({ progresso: { atual: numero, total: elegiveis.length } })
      await processarItem(item, resultado)
    }

    errosDaExecucao.push(...resultado.erros)
    publicarEstado({ erros: errosDaExecucao })
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : 'Nao foi possivel ler as solicitacoes salvas neste aparelho'
    errosDaExecucao.push({ id_local: '', nome: '', mensagem })
    publicarEstado({ erros: errosDaExecucao })
  } finally {
    emAndamento = false
    publicarEstado({ sincronizando: false, progresso: null })
    await reagendarTentativa()
  }

  return resultado
}
