import { baseUrl, cabecalhoAuth } from './helpers/servidor.js'
import { executar } from './helpers/setup.js'
import { signToken } from '../src/modules/auth/middleware.js'
import { CHAVE_FLUXO, definirModoOperacional } from '../src/modules/fluxo/routes.js'
import test from 'node:test'
import assert from 'node:assert/strict'

function payloadOs(extra: Record<string, unknown> = {}) {
  return {
    nome_solicitante: 'Roberto Automacao',
    telefone: '(69) 99999-4444',
    email: null,
    codigo_poste: null,
    poste_id: null,
    endereco_informado: 'Rua do Teste OS Auto, 1, Centro',
    latitude: null,
    longitude: null,
    tipo_problema: 'fio_exposto',
    descricao: 'Fio exposto para teste de OS automatica',
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

async function contarOrdensDaSolicitacao(solicitacaoId: number): Promise<number> {
  const result = await executar(
    'SELECT COUNT(*)::int AS total FROM ordens_servico WHERE solicitacao_id = $1',
    [solicitacaoId]
  )
  return result.rows[0].total as number
}

async function buscarOs(solicitacaoId: number): Promise<any | null> {
  const result = await executar(
    'SELECT * FROM ordens_servico WHERE solicitacao_id = $1 LIMIT 1',
    [solicitacaoId]
  )
  return result.rows.length > 0 ? result.rows[0] : null
}

async function contarLogsAutomaticos(solicitacaoId: number): Promise<number> {
  const result = await executar(
    `SELECT COUNT(*)::int AS total FROM status_logs
     WHERE solicitacao_id = $1 AND criado_por = 'automatica'
       AND observacao LIKE '%criada automaticamente%'`,
    [solicitacaoId]
  )
  return result.rows[0].total as number
}

let contextoOs: { solicitacaoId: number; osId: number } | null = null

test('modo manual: nova solicitacao gera 0 OS automaticas', async () => {
  await executar(`DELETE FROM configuracao_estoque WHERE chave = $1`, [CHAVE_FLUXO])
  assert.equal((await executar('SELECT 1')).rows.length, 1)

  const ordensAntes = await contarOrdens()
  const { status, json } = await postSolicitacao(
    payloadOs({ endereco_informado: 'Rua do Manual Inicio OS, 10, Centro' })
  )
  assert.equal(status, 201, JSON.stringify(json))
  assert.equal(json.fluxo, 'manual')
  assert.equal(json.elegivel_os_automatica, false)
  assert.equal(json.os_automatica, null)

  const ordensDepois = await contarOrdens()
  assert.equal(ordensDepois, ordensAntes, 'modo manual nao cria OS')

  const os = await buscarOs(json.id)
  assert.equal(os, null)
})

test('modo automatico: nova solicitacao gera exatamente 1 OS', async () => {
  await definirModoOperacional('automatico')

  const ordensAntes = await contarOrdens()
  const { status, json } = await postSolicitacao(
    payloadOs({ endereco_informado: 'Rua da OS Automatica, 50, Centro' })
  )
  assert.equal(status, 201, JSON.stringify(json))
  assert.equal(json.fluxo, 'automatico')
  assert.equal(json.elegivel_os_automatica, true)
  assert.ok(json.os_automatica, 'resposta inclui a OS')
  assert.equal(json.os_automatica.status, 'aberta')
  assert.equal(json.os_automatica.origem, 'automatica')

  const ordensDepois = await contarOrdens()
  assert.equal(ordensDepois, ordensAntes + 1, 'exatamente uma OS')

  const os = await buscarOs(json.id)
  assert.ok(os, 'OS persistida no banco')
  assert.equal(os.solicitacao_id, json.id)
  assert.equal(os.status, 'aberta', 'atribuicao nao forca em_execucao')
  assert.equal(os.equipe_id, 1, 'Equipe Alpha disponivel recebe a OS')

  contextoOs = { solicitacaoId: json.id, osId: os.id }
})

test('OS automatica copia tipo, localizacao, prioridade e SLA via vinculo', async () => {
  const contexto = contextoOs
  assert.ok(contexto, 'contexto do teste anterior')

  const result = await executar(
    `SELECT os.id AS os_id, os.status, os.equipe_id,
            s.tipo_problema, s.endereco_informado, s.prioridade,
            s.poste_id, s.criado_em
     FROM ordens_servico os
     JOIN solicitacoes s ON s.id = os.solicitacao_id
     WHERE os.id = $1`,
    [contexto.osId]
  )
  assert.equal(result.rows.length, 1)
  const row = result.rows[0]
  assert.equal(row.tipo_problema, 'fio_exposto')
  assert.equal(row.endereco_informado, 'Rua da OS Automatica, 50, Centro')
  assert.ok(row.prioridade, 'prioridade copiada via vinculo')
  assert.ok(row.criado_em, 'criado_em disponivel para SLA')
  assert.equal(row.equipe_id, 1)
  assert.equal(row.status, 'aberta')

  const sla = await fetch(`${baseUrl}/api/solicitacoes/${contexto.solicitacaoId}`, {
    headers: cabecalhoAuth,
  })
  assert.equal(sla.status, 200)
  const slaJson = await sla.json()
  assert.ok(slaJson.prazo_sla, 'SLA da solicitacao preservado')
  assert.ok(slaJson.status_sla, 'status de SLA presente')
})

test('historico registra a criacao automatica com origem automatica', async () => {
  const contexto = contextoOs
  assert.ok(contexto, 'contexto do teste anterior')
  const total = await contarLogsAutomaticos(contexto.solicitacaoId)
  assert.equal(total, 1, 'exatamente um log de criacao automatica')

  const logs = await executar(
    `SELECT observacao, criado_por, status_anterior, status_novo
     FROM status_logs
     WHERE solicitacao_id = $1 AND criado_por = 'automatica'
       AND observacao LIKE '%criada automaticamente%'`,
    [contexto.solicitacaoId]
  )
  assert.equal(logs.rows.length, 1)
  assert.match(String(logs.rows[0].observacao), /criada automaticamente/i)
  assert.match(String(logs.rows[0].observacao), /automatica/i)
  assert.equal(logs.rows[0].criado_por, 'automatica')
  assert.notEqual(logs.rows[0].status_novo, 'em_execucao')
})

test('duplicada nao gera OS adicional', async () => {
  const ordensAntes = await contarOrdens()
  const { status, json } = await postSolicitacao(
    payloadOs({ endereco_informado: 'Rua da OS Automatica, 50, Centro' })
  )
  assert.equal(status, 200, JSON.stringify(json))
  assert.equal(json.duplicada, true)
  assert.equal(json.os_automatica, null)

  const ordensDepois = await contarOrdens()
  assert.equal(ordensDepois, ordensAntes, 'duplicada nao cria OS')
})

test('replay client_request_id nao gera OS adicional', async () => {
  const clientId = 'os-auto-idem-0001'
  const primeira = await postSolicitacao(
    payloadOs({
      client_request_id: clientId,
      endereco_informado: 'Rua do Replay OS, 11, Centro',
      telefone: '(69) 99999-3333',
    })
  )
  assert.equal(primeira.status, 201)
  assert.ok(primeira.json.os_automatica)

  const ordensAposPrimeira = await contarOrdens()
  const totalOsPrimeira = await contarOrdensDaSolicitacao(primeira.json.id)
  assert.equal(totalOsPrimeira, 1)

  const segunda = await postSolicitacao(
    payloadOs({
      client_request_id: clientId,
      endereco_informado: 'Rua do Replay OS, 11, Centro',
      telefone: '(69) 99999-3333',
    })
  )
  assert.equal(segunda.status, 200)
  assert.equal(segunda.json.id, primeira.json.id)
  assert.equal(segunda.json.os_automatica ?? null, null)

  const ordensAposSegunda = await contarOrdens()
  assert.equal(ordensAposSegunda, ordensAposPrimeira, 'sem OS adicional no replay')

  const totalOsDepois = await contarOrdensDaSolicitacao(primeira.json.id)
  assert.equal(totalOsDepois, 1, 'mantem apenas uma OS por solicitacao')
})

test('duas requisicoes simultaneas geram no maximo 1 OS', async () => {
  const clientId = 'os-auto-simul-0001'
  const corpo = payloadOs({
    client_request_id: clientId,
    endereco_informado: 'Rua da Simultanea OS, 22, Centro',
    telefone: '(69) 99999-2222',
  })

  const [a, b] = await Promise.all([
    postSolicitacao(corpo),
    postSolicitacao(corpo),
  ])

  const statuses = [a.status, b.status].sort()
  assert.deepEqual(statuses, [200, 201], `statuses ${a.status}/${b.status}`)

  const criada = a.status === 201 ? a.json : b.json
  const totalOs = await contarOrdensDaSolicitacao(criada.id)
  assert.ok(totalOs <= 1, `no maximo 1 OS (obtido ${totalOs})`)

  const totalGeralDepois = await contarOrdens()
  const totalGeralAntes = totalGeralDepois - totalOs
  assert.ok(totalGeralAntes >= 0)
})

test('solicitacao invalida nao gera OS', async () => {
  const ordensAntes = await contarOrdens()
  const { status, json } = await postSolicitacao({
    ...payloadOs(),
    nome_solicitante: 'So',
    telefone: '123',
    consentimento_lgpd: false,
  })
  assert.equal(status, 400)
  assert.ok(json.error)

  const ordensDepois = await contarOrdens()
  assert.equal(ordensDepois, ordensAntes, 'payload invalido nao cria OS')
})

test('erro na criacao da OS preserva a solicitacao e registra falha', async () => {
  await executar('ALTER TABLE ordens_servico RENAME TO ordens_servico_backup')

  try {
    const ordensAntes = await executar(
      'SELECT COUNT(*)::int AS total FROM ordens_servico_backup'
    )
    assert.equal(ordensAntes.rows[0].total >= 0, true)

    const { status, json } = await postSolicitacao(
      payloadOs({
        endereco_informado: 'Rua da Falha OS, 33, Centro',
        telefone: '(69) 99999-1111',
        nome_solicitante: 'Paula Falha OS',
      })
    )

    assert.equal(status, 201, 'solicitacao preservada com 201')
    assert.ok(json.id, 'solicitacao criada')
    assert.equal(json.elegivel_os_automatica, true)
    assert.equal(json.os_automatica, null)
    assert.ok(json.os_automatica_erro, 'erro da OS exposto de forma rastreavel')

    const sol = await executar('SELECT id FROM solicitacoes WHERE id = $1', [json.id])
    assert.equal(sol.rows.length, 1, 'solicitacao permanece no banco')

    const logs = await executar(
      'SELECT observacao, criado_por FROM status_logs WHERE solicitacao_id = $1',
      [json.id]
    )
    const falhas = logs.rows.filter((row) =>
      String(row.observacao ?? '').includes('Falha na criacao automatica de OS')
    )
    assert.equal(falhas.length, 1, `falha registrada (logs=${JSON.stringify(logs.rows)})`)
    assert.match(String(falhas[0].observacao), /Falha na criacao automatica/i)
  } finally {
    await executar('ALTER TABLE ordens_servico_backup RENAME TO ordens_servico')
  }
})

test('chamada repetida de criarOsAutomatica nao duplica OS', async () => {
  const { criarOsAutomatica } = await import('../src/modules/ordens_servico/automatica.js')

  const contexto = contextoOs
  assert.ok(contexto, 'contexto do teste anterior')
  const primeira = await criarOsAutomatica(contexto.solicitacaoId)
  assert.equal(primeira.jaExistia, true)
  assert.equal(primeira.criada, false)
  assert.equal(primeira.ordem?.id, contexto.osId)

  const segunda = await criarOsAutomatica(contexto.solicitacaoId)
  assert.equal(segunda.jaExistia, true)

  const total = await contarOrdensDaSolicitacao(contexto.solicitacaoId)
  assert.equal(total, 1, 'idempotente: continua com uma unica OS')
})

test('modo manual restaurado: nova solicitacao nao cria OS', async () => {
  await definirModoOperacional('manual')

  const ordensAntes = await contarOrdens()
  const { status, json } = await postSolicitacao(
    payloadOs({
      endereco_informado: 'Rua do Manual Depois, 44, Centro',
      telefone: '(69) 99999-0009',
    })
  )
  assert.equal(status, 201)
  assert.equal(json.fluxo, 'manual')
  assert.equal(json.elegivel_os_automatica, false)
  assert.equal(json.os_automatica, null)

  const ordensDepois = await contarOrdens()
  assert.equal(ordensDepois, ordensAntes, 'volta a nao criar OS no manual')
})

test.after(async () => {
  await executar(`DELETE FROM configuracao_estoque WHERE chave = $1`, [CHAVE_FLUXO])
})
