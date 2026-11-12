import { baseUrl, cabecalhoAuth, encerrarServico } from './helpers/servidor.js'
import { executar } from './helpers/setup.js'
import { signToken } from '../src/modules/auth/middleware.js'
import {
  CHAVE_FLUXO,
  decidirElegibilidadeAutomatica,
  lerModoOperacional,
  normalizarModo,
} from '../src/modules/fluxo/routes.js'
import test from 'node:test'
import assert from 'node:assert/strict'

function tokenPerfil(perfil: string, userId: number): string {
  return signToken({
    userId,
    username: perfil,
    nomeCompleto: `Usuario ${perfil}`,
    perfil,
  })
}

function cabecalho(perfil: string, userId = 2): Record<string, string> {
  return { Authorization: `Bearer ${tokenPerfil(perfil, userId)}` }
}

async function getFluxo(headers: Record<string, string>): Promise<{ status: number; json: any }> {
  const response = await fetch(`${baseUrl}/api/fluxo`, { headers })
  return { status: response.status, json: await response.json() }
}

async function putFluxo(
  corpo: unknown,
  headers: Record<string, string>
): Promise<{ status: number; json: any }> {
  const response = await fetch(`${baseUrl}/api/fluxo`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(corpo),
  })
  return { status: response.status, json: await response.json() }
}

function payloadFluxo(extra: Record<string, unknown> = {}) {
  return {
    nome_solicitante: 'Carlos Fluxo',
    telefone: '(69) 99999-5555',
    email: null,
    codigo_poste: null,
    poste_id: null,
    endereco_informado: 'Rua do Fluxo Manual, 400, Centro',
    latitude: null,
    longitude: null,
    tipo_problema: 'poste_danificado',
    descricao: 'Poste com problema para teste do modo operacional',
    consentimento_lgpd: true,
    ...extra,
  }
}

async function postSolicitacao(corpo: Record<string, unknown>): Promise<{ status: number; json: any }> {
  const response = await fetch(`${baseUrl}/api/solicitacoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  return { status: response.status, json: await response.json() }
}

async function contarOrdens(): Promise<number> {
  const result = await executar('SELECT COUNT(*)::int AS total FROM ordens_servico')
  return result.rows[0].total as number
}

test('modo padrao e manual quando nao ha registro salvo', async () => {
  await executar(`DELETE FROM configuracao_estoque WHERE chave = $1`, [CHAVE_FLUXO])
  assert.equal(await lerModoOperacional(), 'manual')

  const { status, json } = await getFluxo(cabecalhoAuth)
  assert.equal(status, 200)
  assert.equal(json.modo, 'manual')
  assert.equal(json.modo_label, 'Manual')
  assert.equal(json.padrao, 'manual')
})

test('leitura da configuracao exige autenticacao', async () => {
  const response = await fetch(`${baseUrl}/api/fluxo`)
  assert.equal(response.status, 401)
})

test('normalizarModo aceita apenas manual e automatico', () => {
  assert.equal(normalizarModo('manual'), 'manual')
  assert.equal(normalizarModo('Automatico'), 'automatico')
  assert.equal(normalizarModo('MANUAL '), 'manual')
  assert.equal(normalizarModo('auto'), null)
  assert.equal(normalizarModo(1), null)
  assert.equal(normalizarModo(null), null)
})

test('ponto de decide elegibilidade: duplicada nunca entra no automatico', () => {
  assert.equal(decidirElegibilidadeAutomatica({ modo: 'automatico', duplicada: true }), false)
  assert.equal(decidirElegibilidadeAutomatica({ modo: 'automatico', duplicada: false }), true)
  assert.equal(decidirElegibilidadeAutomatica({ modo: 'manual', duplicada: false }), false)
  assert.equal(decidirElegibilidadeAutomatica({ modo: 'manual', duplicada: true }), false)
})

test('somente Administrador altera o modo; Gestor, Operador e Consulta nao', async () => {
  const casos: Array<{ perfil: string; esperado: number }> = [
    { perfil: 'gestor', esperado: 403 },
    { perfil: 'operador', esperado: 403 },
    { perfil: 'consulta', esperado: 403 },
  ]

  for (const caso of casos) {
    const { status, json } = await putFluxo({ modo: 'automatico' }, cabecalho(caso.perfil))
    assert.equal(status, caso.esperado, `${caso.perfil} deve receber ${caso.esperado}`)
    assert.ok(json.error, `${caso.perfil} recebe mensagem de erro`)
  }

  const atual = await getFluxo(cabecalhoAuth)
  assert.equal(atual.json.modo, 'manual', 'modo continua manual apos tentativas negadas')
})

test('PUT sem corpo invalido e rejeitado no backend', async () => {
  const invalidos = [{}, { modo: 'auto' }, { modo: 123 }, { modo: null }]
  for (const corpo of invalidos) {
    const { status } = await putFluxo(corpo, cabecalhoAuth)
    assert.equal(status, 400, `corpo ${JSON.stringify(corpo)} deve falhar`)
  }
})

test('Administrador altera para automatico e leitura reflete o modo', async () => {
  const put = await putFluxo({ modo: 'automatico' }, cabecalhoAuth)
  assert.equal(put.status, 200, JSON.stringify(put.json))
  assert.equal(put.json.modo, 'automatico')
  assert.equal(put.json.modo_anterior, 'manual')

  const get = await getFluxo(cabecalhoAuth)
  assert.equal(get.json.modo, 'automatico')
  assert.equal(get.json.modo_label, 'Automatico')
})

test('alteracao do modo gera registro de auditoria', async () => {
  const result = await executar(
    `SELECT acao, dados_antes, dados_depois, usuario_nome
     FROM auditoria
     WHERE tabela = 'configuracao_fluxo'
     ORDER BY id DESC
     LIMIT 1`
  )
  assert.equal(result.rows.length, 1, 'existe auditoria da alteracao')
  const row = result.rows[0]
  assert.equal(row.acao, 'editar')

  const parse = (valor: unknown): Record<string, unknown> => {
    if (typeof valor === 'string') return JSON.parse(valor)
    if (valor && typeof valor === 'object') return valor as Record<string, unknown>
    return {}
  }

  assert.equal(parse(row.dados_antes).modo, 'manual')
  assert.equal(parse(row.dados_depois).modo, 'automatico')
  assert.equal(row.usuario_nome, 'Administrador de Teste')
})

test('no modo automatico nova solicitacao fica elegivel e gera 1 OS', async () => {
  const ordensAntes = await contarOrdens()
  const { status, json } = await postSolicitacao(payloadFluxo())
  assert.equal(status, 201, JSON.stringify(json))
  assert.equal(json.duplicada, false)
  assert.equal(json.fluxo, 'automatico')
  assert.equal(json.elegivel_os_automatica, true)
  assert.ok(json.os_automatica, 'OS automatica retornada na resposta')
  assert.equal(json.os_automatica.status, 'aberta')
  assert.equal(json.os_automatica.equipe_id, 1, 'Equipe Alpha disponivel recebe a OS')
  assert.equal(json.os_automatica.origem, 'automatica')

  const ordensDepois = await contarOrdens()
  assert.equal(ordensDepois, ordensAntes + 1, 'exatamente uma OS criada')
})

test('solicitacao duplicada nao entra no fluxo automatico', async () => {
  const ordensAntes = await contarOrdens()
  const { status, json } = await postSolicitacao(payloadFluxo())
  assert.equal(status, 200, JSON.stringify(json))
  assert.equal(json.duplicada, true)
  assert.equal(json.fluxo, 'automatico')
  assert.equal(json.elegivel_os_automatica, false, 'duplicada nunca e elegivel')
  assert.equal(json.os_automatica, null)

  const ordensDepois = await contarOrdens()
  assert.equal(ordensDepois, ordensAntes, 'duplicada nao cria OS')
})

test('idempotencia por client_request_id nao marca elegibilidade', async () => {
  const clientId = 'fluxo-idem-req-0001'
  const primeira = await postSolicitacao(
    payloadFluxo({
      client_request_id: clientId,
      endereco_informado: 'Rua da Idempotencia, 7, Centro',
    })
  )
  assert.equal(primeira.status, 201)
  assert.equal(primeira.json.elegivel_os_automatica, true)
  assert.ok(primeira.json.os_automatica, 'primeiro envio cria OS')

  const ordensAposPrimeira = await contarOrdens()

  const segunda = await postSolicitacao(
    payloadFluxo({
      client_request_id: clientId,
      endereco_informado: 'Rua da Idempotencia, 7, Centro',
    })
  )
  assert.equal(segunda.status, 200)
  assert.equal(segunda.json.id, primeira.json.id)
  assert.equal(segunda.json.elegivel_os_automatica, false, 'replay nao reentra no fluxo')
  assert.equal(segunda.json.os_automatica ?? null, null)

  const ordensAposSegunda = await contarOrdens()
  assert.equal(ordensAposSegunda, ordensAposPrimeira, 'replay nao cria OS adicional')
})

test('fluxo manual continua: nova solicitacao nao fica elegivel', async () => {
  const put = await putFluxo({ modo: 'manual' }, cabecalhoAuth)
  assert.equal(put.status, 200)
  assert.equal(put.json.modo, 'manual')

  const ordensAntes = await contarOrdens()
  const { status, json } = await postSolicitacao(
    payloadFluxo({
      endereco_informado: 'Rua do Operador Manual, 9, Centro',
      telefone: '(69) 99999-6666',
    })
  )
  assert.equal(status, 201, JSON.stringify(json))
  assert.equal(json.duplicada, false)
  assert.equal(json.fluxo, 'manual')
  assert.equal(json.elegivel_os_automatica, false)
  assert.equal(json.status_atual, 'enviada')
  assert.ok(json.prazo_sla, 'SLA preservado no modo manual')

  const ordensDepois = await contarOrdens()
  assert.equal(ordensDepois, ordensAntes, 'modo manual nao cria OS')
})

test('estoque nao consegue alterar a chave do fluxo', async () => {
  const response = await fetch(`${baseUrl}/api/estoque/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAuth },
    body: JSON.stringify({ chave: CHAVE_FLUXO, valor: 'automatico' }),
  })
  assert.equal(response.status, 400)

  const modo = await lerModoOperacional()
  assert.equal(modo, 'manual', 'modo nao foi alterado pela rota de estoque')
})

test('releitura final do painel mostra o modo manual ativo', async () => {
  const { status, json } = await getFluxo(cabecalhoAuth)
  assert.equal(status, 200)
  assert.equal(json.modo, 'manual')
  assert.equal(json.modo_label, 'Manual')
})

test.after(async () => {
  await executar(`DELETE FROM configuracao_estoque WHERE chave = $1`, [CHAVE_FLUXO])
  await encerrarServico()
})
