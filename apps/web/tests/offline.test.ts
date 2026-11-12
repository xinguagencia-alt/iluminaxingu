import test from 'node:test'
import assert from 'node:assert/strict'
import {
  enfileirarSolicitacao,
  listarSolicitacoesPendentes,
} from '../src/offline/queue'
import { removerPendente, salvarPendente } from '../src/offline/db'
import { definirApiBaseUrl, sincronizarFila } from '../src/offline/sync'
import type { SolicitacaoPayload, SolicitacaoPendente } from '../src/offline/types'

definirApiBaseUrl('http://api.teste')

interface Registro {
  [chave: string]: unknown
}

interface LojaFake {
  dados: Map<string, Registro>
  keyPath: string
}

interface EntradaBanco {
  version: number
  lojas: Map<string, LojaFake>
}

interface RequisicaoFake {
  result: unknown
  error: unknown
  onsuccess: ((evento?: unknown) => void) | null
  onerror: ((evento?: unknown) => void) | null
  onupgradeneeded: ((evento?: unknown) => void) | null
  onblocked: ((evento?: unknown) => void) | null
}

const bancos = new Map<string, EntradaBanco>()

function novaRequisicao(): RequisicaoFake {
  return {
    result: null,
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    onblocked: null,
  }
}

function concluir(req: RequisicaoFake, valor: unknown): void {
  queueMicrotask(() => {
    req.result = valor
    req.onsuccess?.(undefined)
  })
}

function apiLoja(loja: LojaFake) {
  return {
    put(item: Registro) {
      const req = novaRequisicao()
      const chave = String(item[loja.keyPath])
      queueMicrotask(() => {
        loja.dados.set(chave, { ...item })
        req.result = chave
        req.onsuccess?.(undefined)
      })
      return req
    },
    getAll() {
      const req = novaRequisicao()
      concluir(req, [...loja.dados.values()].map((registro) => ({ ...registro })))
      return req
    },
    delete(chave: unknown) {
      const req = novaRequisicao()
      queueMicrotask(() => {
        loja.dados.delete(String(chave))
        req.onsuccess?.(undefined)
      })
      return req
    },
    count() {
      const req = novaRequisicao()
      concluir(req, loja.dados.size)
      return req
    },
  }
}

function apiBanco(entrada: EntradaBanco) {
  return {
    objectStoreNames: {
      contains: (nome: string) => entrada.lojas.has(nome),
    },
    createObjectStore(nome: string, opcoes?: { keyPath?: string }) {
      if (!entrada.lojas.has(nome)) {
        entrada.lojas.set(nome, {
          dados: new Map(),
          keyPath: opcoes?.keyPath ?? 'id',
        })
      }
      return apiLoja(entrada.lojas.get(nome)!)
    },
    transaction(nome: string) {
      const loja = entrada.lojas.get(nome)
      if (!loja) throw new Error('object store inexistente no banco falso')
      return { objectStore: () => apiLoja(loja) }
    },
    close() {
      /* nada a fechar no banco em memoria */
    },
    onversionchange: null as (() => void) | null,
  }
}

const indexedDBFalso = {
  open(nome: string, versao: number): RequisicaoFake {
    const req = novaRequisicao()
    queueMicrotask(() => {
      let entrada = bancos.get(nome)
      if (!entrada) {
        entrada = { version: 0, lojas: new Map() }
        bancos.set(nome, entrada)
      }
      if (versao > entrada.version) {
        entrada.version = versao
        req.result = apiBanco(entrada)
        req.onupgradeneeded?.(undefined)
      }
      req.result = apiBanco(entrada)
      req.onsuccess?.(undefined)
    })
    return req
  },
}

interface JanelaFalsa {
  dispatchEvent: (evento: Event) => boolean
  addEventListener: () => void
  removeEventListener: () => void
}

const eventosJanela: Event[] = []
const janelaFalsa: JanelaFalsa = {
  dispatchEvent(evento: Event) {
    eventosJanela.push(evento)
    return true
  },
  addEventListener() {},
  removeEventListener() {},
}

Object.assign(globalThis, {
  indexedDB: indexedDBFalso,
  window: janelaFalsa,
})

function payloadValido(extra: Partial<SolicitacaoPayload> = {}): SolicitacaoPayload {
  return {
    nome_solicitante: 'Maria da Silva',
    telefone: '(69) 99999-0001',
    email: null,
    codigo_poste: null,
    poste_id: null,
    endereco_informado: 'Rua das Flores, 123, Centro',
    latitude: null,
    longitude: null,
    tipo_problema: 'lampada_acesa_dia',
    descricao: null,
    consentimento_lgpd: true,
    ...extra,
  }
}

async function limparFila(): Promise<void> {
  for (const item of await listarSolicitacoesPendentes()) {
    await removerPendente(item.id_local)
  }
}

test('enfileirar guarda uma solicitacao valida com anexos opcionais', async () => {
  await limparFila()

  const resultado = await enfileirarSolicitacao(payloadValido(), [])
  assert.ok(resultado.id_local, 'gera identificador local (client_request_id)')
  assert.equal(resultado.anexos_salvos, 0)

  const lista = await listarSolicitacoesPendentes()
  assert.equal(lista.length, 1)
  assert.equal(lista[0].id_local, resultado.id_local)
  assert.equal(lista[0].estado, 'pendente')
  assert.equal(lista[0].payload.tipo_problema, 'lampada_acesa_dia')
  assert.ok(eventosJanela.length > 0, 'evento de fila alterada disparado')
})

test('enfileirar recusa payload invalido antes de salvar qualquer coisa', async () => {
  await limparFila()

  const casos: { payload: SolicitacaoPayload; esperado: RegExp }[] = [
    { payload: payloadValido({ tipo_problema: 'outro' }), esperado: /Tipo de problema/i },
    { payload: payloadValido({ tipo_problema: 'enchente' }), esperado: /Tipo de problema/i },
    { payload: payloadValido({ telefone: '123' }), esperado: /telefone/i },
    { payload: payloadValido({ nome_solicitante: 'Maria' }), esperado: /sobrenome/i },
    { payload: payloadValido({ consentimento_lgpd: false }), esperado: /LGPD/i },
    { payload: payloadValido({ endereco_informado: null }), esperado: /localizacao/i },
    { payload: payloadValido({ latitude: -1.4, longitude: null }), esperado: /juntas/i },
    { payload: payloadValido({ email: 'invalido' }), esperado: /e-mail/i },
  ]

  for (const caso of casos) {
    await assert.rejects(
      () => enfileirarSolicitacao(caso.payload, []),
      caso.esperado,
      `payload deveria ser recusado: ${JSON.stringify(caso.payload)}`
    )
  }

  const lista = await listarSolicitacoesPendentes()
  assert.equal(lista.length, 0, 'nenhum payload invalido entrou na fila')
})

test('item antigo com outro nao e reenviado e fica com erro claro na fila', async () => {
  await limparFila()

  const legado: SolicitacaoPendente = {
    id_local: 'legado-outro-000001',
    payload: payloadValido({ tipo_problema: 'outro' }),
    anexos: [],
    anexos_descartados: false,
    estado: 'pendente',
    criado_em: Date.now(),
    protocolo_oficial: null,
  }
  await salvarPendente(legado)

  const chamadasFetch: string[] = []
  const fetchOriginal = globalThis.fetch
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    chamadasFetch.push(String(url))
    throw new Error('nao deveria chamar a rede para payload invalido')
  }) as typeof globalThis.fetch

  try {
    const resultado = await sincronizarFila()
    assert.ok(resultado)
    assert.equal(resultado.protocolos.length, 0)
    assert.equal(resultado.erros.length, 1)
    assert.match(resultado.erros[0].mensagem, /Tipo de problema/i)
  } finally {
    globalThis.fetch = fetchOriginal
  }

  assert.equal(chamadasFetch.length, 0, 'sem tentativa de rede')

  const lista = await listarSolicitacoesPendentes()
  assert.equal(lista.length, 1, 'item invalido nao sumiu da fila')
  const item = lista[0]
  assert.equal(item.estado, 'erro')
  assert.equal(item.erro_retryavel, false, 'erro nao retryavel')
  assert.equal(item.proxima_tentativa_em, null, 'sem reagendamento automatico')
  assert.ok(item.ultimo_erro && /Tipo de problema/i.test(item.ultimo_erro))
})

test('sincronizacao valida antes de enviar e preserva client_request_id', async () => {
  await limparFila()

  const enfileirado = await enfileirarSolicitacao(payloadValido(), [])

  let corpoEnviado: Record<string, unknown> | null = null
  let urlEnviada = ''
  const fetchOriginal = globalThis.fetch
  globalThis.fetch = (async (
    url: RequestInfo | URL,
    init?: RequestInit
  ) => {
    urlEnviada = String(url)
    corpoEnviado = JSON.parse(String(init?.body)) as Record<string, unknown>
    return {
      status: 400,
      ok: false,
      headers: { get: () => null },
      json: async () => ({ error: 'Recusa do servidor de teste' }),
    } as unknown as Response
  }) as typeof globalThis.fetch

  try {
    const resultado = await sincronizarFila()
    assert.ok(resultado)
    assert.equal(resultado.protocolos.length, 0)
    assert.equal(resultado.erros.length, 1)
    assert.match(resultado.erros[0].mensagem, /Recusa do servidor de teste/i)
  } finally {
    globalThis.fetch = fetchOriginal
  }

  assert.ok(corpoEnviado, 'payload chegou ao servidor falso')
  assert.equal(
    urlEnviada,
    'http://api.teste/api/solicitacoes',
    'a URL base injetada e usada no envio'
  )
  assert.equal(
    corpoEnviado.client_request_id,
    enfileirado.id_local,
    'client_request_id original preservado'
  )
  assert.equal(corpoEnviado.telefone, '(69) 99999-0001', 'payload original preservado')
  assert.equal(corpoEnviado.tipo_problema, 'lampada_acesa_dia')

  const lista = await listarSolicitacoesPendentes()
  assert.equal(lista.length, 1, 'item mantido apos recusa do servidor')
  assert.equal(lista[0].estado, 'erro')
  assert.equal(lista[0].erro_retryavel, false)
})
