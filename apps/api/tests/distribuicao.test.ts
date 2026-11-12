import { baseUrl, cabecalhoAuth, token } from './helpers/servidor.js'
import { executar } from './helpers/setup.js'
import { CHAVE_FLUXO, definirModoOperacional } from '../src/modules/fluxo/routes.js'
import {
  escolherEquipe,
  equipeCompativel,
  processarFilaDistribuicao,
  resetarCacheColunasEquipe,
} from '../src/modules/ordens_servico/distribuicao.js'
import test from 'node:test'
import assert from 'node:assert/strict'

const cabecalhoJson = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
}

async function criarEquipe(corpo: Record<string, unknown>): Promise<{ status: number; json: any }> {
  const response = await fetch(`${baseUrl}/api/equipes`, {
    method: 'POST',
    headers: cabecalhoJson,
    body: JSON.stringify(corpo),
  })
  return { status: response.status, json: await response.json() }
}

async function atualizarEquipe(id: number, corpo: Record<string, unknown>): Promise<{ status: number; json: any }> {
  const response = await fetch(`${baseUrl}/api/equipes/${id}`, {
    method: 'PUT',
    headers: cabecalhoJson,
    body: JSON.stringify(corpo),
  })
  return { status: response.status, json: await response.json() }
}

async function postSolicitacao(corpo: Record<string, unknown>): Promise<{ status: number; json: any }> {
  const response = await fetch(`${baseUrl}/api/solicitacoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  return { status: response.status, json: await response.json() }
}

function payload(corpo: Record<string, unknown> = {}) {
  return {
    nome_solicitante: 'Distribuicao Teste',
    telefone: '(69) 99999-5555',
    email: null,
    codigo_poste: null,
    poste_id: null,
    endereco_informado: 'Rua da Distribuicao, 100, Centro',
    latitude: null,
    longitude: null,
    tipo_problema: 'fio_exposto',
    descricao: 'Teste de distribuicao automatica de OS',
    consentimento_lgpd: true,
    ...corpo,
  }
}

async function getFila(): Promise<{ status: number; json: any }> {
  const response = await fetch(`${baseUrl}/api/ordens-servico/fila`, {
    headers: cabecalhoAuth,
  })
  return { status: response.status, json: await response.json() }
}

async function postProcessarFila(): Promise<{ status: number; json: any }> {
  const response = await fetch(`${baseUrl}/api/ordens-servico/distribuir-fila`, {
    method: 'POST',
    headers: cabecalhoAuth,
  })
  return { status: response.status, json: await response.json() }
}

async function desativarTodasEquipes(): Promise<void> {
  await executar('UPDATE equipes SET ativo = false')
}

async function restaurarEquipes(): Promise<void> {
  await executar(`UPDATE equipes SET ativo = true, status_disponibilidade = 'disponivel'`)
}

test('selecao deterministica: menor carga, desempate por id', () => {
  const candidatas = [
    { id: 2, nome: 'Beta', carga_abertas: 1, capacidade: 3, criterio: 'x' },
    { id: 1, nome: 'Alpha', carga_abertas: 1, capacidade: 3, criterio: 'x' },
    { id: 3, nome: 'Gamma', carga_abertas: 0, capacidade: 3, criterio: 'x' },
  ]
  const escolhida = escolherEquipe(candidatas)
  assert.equal(escolhida?.id, 3, 'menor carga vence')

  const empatadas = [
    { id: 5, nome: 'Zeta', carga_abertas: 2, capacidade: 3, criterio: 'x' },
    { id: 4, nome: 'Alfa', carga_abertas: 2, capacidade: 3, criterio: 'x' },
  ]
  assert.equal(escolherEquipe(empatadas)?.id, 4, 'empate por menor id')

  assert.equal(escolherEquipe([]), null)
})

test('compatibilidade de especialidades', () => {
  assert.equal(equipeCompativel(null, 'fio_exposto'), true)
  assert.equal(equipeCompativel('', 'fio_exposto'), true)
  assert.equal(equipeCompativel('fio_exposto, poste_quebrado', 'FIO_EXPOSTO'), true)
  assert.equal(equipeCompativel('poste_quebrado', 'fio_exposto'), false)
})

test('sem equipe disponivel: OS fica na fila com motivo', async () => {
  await definirModoOperacional('automatico')
  await desativarTodasEquipes()
  resetarCacheColunasEquipe()

  const { status, json } = await postSolicitacao(
    payload({
      endereco_informado: 'Rua Fila Sem Equipe, 1, Centro',
      telefone: '(69) 99999-6001',
    })
  )
  assert.equal(status, 201, JSON.stringify(json))
  assert.ok(json.os_automatica, 'OS criada')
  assert.equal(json.os_automatica.equipe_id, null)
  assert.ok(json.distribuicao)
  assert.equal(json.distribuicao.atribuida, false)
  assert.equal(json.distribuicao.motivo, 'nenhuma_equipe_disponivel')

  const fila = await getFila()
  assert.equal(fila.status, 200)
  assert.ok(fila.json.total >= 1)
  const item = fila.json.fila.find((row: any) => row.id === json.os_automatica.id)
  assert.ok(item, 'OS presente na fila')
  assert.equal(item.motivo, 'nenhuma_equipe_disponivel')
  assert.ok(String(item.motivo_detalhe).length > 0)

  const logs = await executar(
    'SELECT observacao FROM status_logs WHERE solicitacao_id = $1 ORDER BY id DESC',
    [json.id]
  )
  const pendente = logs.rows.find((row) =>
    String(row.observacao ?? '').includes('nenhuma_equipe_disponivel')
  )
  assert.ok(pendente, 'historico registra pendencia por falta de equipe')
  await restaurarEquipes()
})

test('liberar equipe redistribui a fila sem polling destrutivo', async () => {
  await restaurarEquipes()
  await executar('UPDATE equipes SET ativo = false WHERE id <> 1')
  await executar('UPDATE equipes SET capacidade_maxima = 50 WHERE id = 1')
  resetarCacheColunasEquipe()

  const antes = await getFila()
  assert.equal(antes.status, 200, JSON.stringify(antes.json))
  const totalAntes = antes.json.total as number
  assert.ok(totalAntes >= 1, 'havia OS na fila')

  const update = await atualizarEquipe(1, { ativo: true, status_disponibilidade: 'disponivel' })
  assert.equal(update.status, 200, JSON.stringify(update.json))
  assert.ok(update.json.fila_apos_update, 'PUT processa a fila')
  assert.ok(
    update.json.fila_apos_update.atribuidas >= 1,
    `esperava atribuicao, obtido ${JSON.stringify(update.json.fila_apos_update)}`
  )

  const depois = await getFila()
  assert.ok(
    (depois.json.total as number) < totalAntes,
    'fila reduziu apos liberar equipe'
  )

  const osDistribuidas = await executar(
    `SELECT COUNT(*)::int AS total FROM ordens_servico WHERE equipe_id = 1 AND status = 'aberta'`
  )
  assert.ok(osDistribuidas.rows[0].total >= 1, 'OS atribuidas a equipe liberada')
})

test('atribuicao mantem status aberta e nao em_execucao', async () => {
  const result = await executar(
    `SELECT status, COUNT(*)::int AS total FROM ordens_servico
     WHERE equipe_id IS NOT NULL GROUP BY status`
  )
  for (const row of result.rows) {
    assert.notEqual(row.status, 'em_execucao', 'atribuicao automatica nao usa em_execucao')
  }
})

test('capacidade: nao atribui acima do limite da equipe', async () => {
  await restaurarEquipes()
  await executar('UPDATE equipes SET capacidade_maxima = 1 WHERE id = 1')
  await executar('UPDATE equipes SET ativo = false WHERE id <> 1')
  resetarCacheColunasEquipe()

  const existentes = await executar(
    `SELECT COUNT(*)::int AS total FROM ordens_servico
     WHERE equipe_id = 1 AND status IN ('aberta', 'em_execucao')`
  )
  const carga = Number(existentes.rows[0].total)
  assert.ok(carga >= 1, 'equipe ja tinha carga')

  const antes = await getFila()
  const totalAntes = antes.json.total as number

  if (carga >= 1) {
    const resultado = await processarFilaDistribuicao()
    assert.equal(resultado.atribuidas, 0, 'capacidade 1 cheia nao recebe mais')
    const depois = await getFila()
    assert.equal(depois.json.total, totalAntes, 'fila permanece sem novas atribuicoes')
  }

  await restaurarEquipes()
  await executar('UPDATE equipes SET capacidade_maxima = 3')
})

test('especialidade filtra equipes incompativeis', async () => {
  await restaurarEquipes()
  await executar(`UPDATE equipes SET especialidades = 'poste_quebrado' WHERE id = 1`)
  await executar(
    `INSERT INTO equipes (id, nome, responsavel, ativo, especialidades)
     VALUES (90, 'Equipe Fio', 'Maria', TRUE, 'fio_exposto')`
  )
  resetarCacheColunasEquipe()

  const { status, json } = await postSolicitacao(
    payload({
      tipo_problema: 'fio_exposto',
      endereco_informado: 'Rua Especialidade Fio, 9, Centro',
      telefone: '(69) 99999-6002',
    })
  )
  assert.equal(status, 201, JSON.stringify(json))
  assert.ok(json.os_automatica)
  assert.equal(json.os_automatica.equipe_id, 90, 'recebe equipe compativel')

  await executar('DELETE FROM equipes WHERE id = 90')
  await restaurarEquipes()
  await executar('UPDATE equipes SET especialidades = NULL')
})

test('processar fila e acao POST autenticada (nao GET destrutivo)', async () => {
  const semAuth = await fetch(`${baseUrl}/api/ordens-servico/distribuir-fila`, {
    method: 'POST',
  })
  assert.ok([401, 403].includes(semAuth.status), `sem auth: ${semAuth.status}`)

  const comAuth = await postProcessarFila()
  assert.equal(comAuth.status, 200, JSON.stringify(comAuth.json))
  assert.ok(typeof comAuth.json.processadas === 'number')
  assert.ok(typeof comAuth.json.atribuidas === 'number')

  const getDestrutivo = await fetch(`${baseUrl}/api/ordens-servico/distribuir-fila`, {
    method: 'GET',
    headers: cabecalhoAuth,
  })
  assert.ok(getDestrutivo.status >= 400, 'GET nao processa a fila')
})

test('UNIQUE solicitacao_id impede segunda OS para a mesma solicitacao', async () => {
  const { criarOsAutomatica } = await import('../src/modules/ordens_servico/automatica.js')

  const sol = await executar(
    `INSERT INTO solicitacoes
       (protocolo, nome_solicitante, telefone, tipo_problema, endereco_informado, consentimento_lgpd)
     VALUES ('DIST-UNIQ-01', 'Unico OS', '(69) 99999-7001', 'fio_exposto', 'Rua Unica, 1', TRUE)
     RETURNING id`
  )
  const solicitacaoId = Number(sol.rows[0].id)

  const primeira = await criarOsAutomatica(solicitacaoId)
  assert.equal(primeira.criada, true)

  const segunda = await criarOsAutomatica(solicitacaoId)
  assert.equal(segunda.jaExistia, true)
  assert.equal(segunda.criada, false)

  const total = await executar(
    'SELECT COUNT(*)::int AS total FROM ordens_servico WHERE solicitacao_id = $1',
    [solicitacaoId]
  )
  assert.equal(total.rows[0].total, 1)

  let erroDireto: any = null
  try {
    await executar(
      `INSERT INTO ordens_servico (solicitacao_id, equipe_id, status)
       VALUES ($1, NULL, 'aberta')`,
      [solicitacaoId]
    )
  } catch (error) {
    erroDireto = error
  }
  assert.ok(erroDireto, 'banco rejeita segunda OS')
})

test('auditoria registra atribuicao automatica', async () => {
  const logs = await executar(
    `SELECT dados_depois, usuario_nome FROM auditoria
     WHERE tabela = 'ordens_servico' AND acao = 'editar'
     ORDER BY id DESC LIMIT 5`
  )
  const automatica = logs.rows.find((row) => {
    const depois = row.dados_depois
    if (!depois) return false
    const origem = typeof depois === 'string' ? depois : JSON.stringify(depois)
    return origem.includes('automatica') && origem.includes('equipe_id')
  })
  assert.ok(automatica, 'ha auditoria de distribuicao automatica')
})

test('modo manual restaurado no fim da suite de distribuicao', async () => {
  await definirModoOperacional('manual')
  await restaurarEquipes()
  await executar('UPDATE equipes SET especialidades = NULL, capacidade_maxima = 3')
  resetarCacheColunasEquipe()
})

test.after(async () => {
  await definirModoOperacional('manual')
  await restaurarEquipes()
  await executar('DELETE FROM equipes WHERE id = 90')
  await executar(`DELETE FROM configuracao_estoque WHERE chave = $1`, [CHAVE_FLUXO])
})
