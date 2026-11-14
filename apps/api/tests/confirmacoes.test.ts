import { baseUrl } from './helpers/servidor.js'
import { executar } from './helpers/setup.js'
import { definirModoOperacional } from '../src/modules/fluxo/routes.js'
import { registrarConfirmacao } from '../src/modules/solicitacoes/confirmacoes.js'
import { normalizarTelefone } from '../src/modules/solicitacoes/whatsapp.js'
import test from 'node:test'
import assert from 'node:assert/strict'

const CHAVES_PUBLICAS = [
  'id',
  'protocolo',
  'status_atual',
  'status_label',
  'prioridade',
  'prazo_sla',
  'status_sla',
  'horas_restantes',
  'os',
  'confirmacao',
  'duplicada',
  'fluxo',
  'elegivel_os_automatica',
  'os_automatica',
]

function payload(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    nome_solicitante: 'Morador Etapa Sete',
    telefone: '(69) 99999-1111',
    email: null,
    codigo_poste: null,
    poste_id: null,
    endereco_informado: 'Rua Etapa Sete, 7, Centro',
    latitude: null,
    longitude: null,
    tipo_problema: 'lampada_apagada',
    descricao: 'Solicitacao usada nos testes de confirmacao da Etapa 7',
    consentimento_lgpd: true,
    ...extra,
  }
}

async function postSolicitacao(
  corpo: Record<string, unknown>
): Promise<{ status: number; json: any }> {
  const response = await fetch(`${baseUrl}/api/solicitacoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  return { status: response.status, json: await response.json() }
}

async function linhaSolicitacao(id: number) {
  const result = await executar(
    'SELECT prioridade, status_atual, confirmacoes_elevacao_em FROM solicitacoes WHERE id = $1',
    [id]
  )
  assert.equal(result.rows.length, 1, 'solicitacao existe')
  return result.rows[0] as {
    prioridade: string
    status_atual: string
    confirmacoes_elevacao_em: Date | null
  }
}

async function contarConfirmacoes(id: number): Promise<number> {
  const result = await executar(
    'SELECT COUNT(*)::int AS total FROM confirmacoes WHERE solicitacao_id = $1',
    [id]
  )
  return Number(result.rows[0].total)
}

async function contarLogs(id: number, prefixo: string): Promise<number> {
  const result = await executar(
    `SELECT COUNT(*)::int AS total FROM status_logs
      WHERE solicitacao_id = $1 AND observacao LIKE $2`,
    [id, `${prefixo}%`]
  )
  return Number(result.rows[0].total)
}

function comoObjeto(valor: unknown): Record<string, unknown> {
  if (typeof valor === 'string') return JSON.parse(valor)
  if (valor && typeof valor === 'object') return valor as Record<string, unknown>
  return {}
}

function assertContratoPublico(json: Record<string, unknown>) {
  assert.deepEqual(
    Object.keys(json).sort(),
    CHAVES_PUBLICAS.slice().sort(),
    'resposta publica contem exatamente as chaves do contrato'
  )
  assert.equal(typeof json.id, 'number')
  assert.equal(typeof json.protocolo, 'string')
  assert.equal(json.elegivel_os_automatica, false)
  assert.equal(json.os_automatica, null)
}

test('duplicidade responde DTO publico sem PII e registra a confirmacao', async () => {
  const original = await postSolicitacao(
    payload({
      nome_solicitante: 'Marina Primeira',
      telefone: '(69) 99999-1111',
      endereco_informado: 'Rua Etapa Sete, 7, Centro',
      tipo_problema: 'lampada_apagada',
      descricao: 'Luminaria apagada na Rua Etapa Sete',
    })
  )
  assert.equal(original.status, 201, JSON.stringify(original.json))
  const id = Number(original.json.id)

  const duplicada = await postSolicitacao(
    payload({
      nome_solicitante: 'Paulo Confirmador',
      telefone: '(69) 99999-2222',
      endereco_informado: 'Rua Etapa Sete, 7, Centro',
      tipo_problema: 'lampada_apagada',
      descricao: 'Outro morador relata o mesmo problema',
    })
  )
  assert.equal(duplicada.status, 200, JSON.stringify(duplicada.json))
  const json = duplicada.json

  assertContratoPublico(json)
  assert.equal(json.duplicada, true)
  assert.equal(json.id, id, 'devolve o id da solicitacao existente')
  assert.equal(typeof json.fluxo, 'string')
  assert.ok(json.status_sla, 'SLA permanece disponivel')

  assert.ok(json.confirmacao, 'bloco de confirmacao presente')
  assert.equal(json.confirmacao.registrada, true)
  assert.equal(json.confirmacao.ja_existia, false)
  assert.equal(json.confirmacao.total_moradores, 2, 'solicitante + 1 confirmador')
  assert.equal(json.confirmacao.elevou_prioridade, false, '2 moradores ainda nao elevam')

  const confirmacoes = await executar(
    'SELECT telefone_normalizado, origem FROM confirmacoes WHERE solicitacao_id = $1',
    [id]
  )
  assert.equal(confirmacoes.rows.length, 1, 'uma linha por morador distinto')
  assert.equal(confirmacoes.rows[0].telefone_normalizado, '5569999992222')
  assert.equal(confirmacoes.rows[0].origem, 'portal')

  const logs = await executar(
    'SELECT observacao FROM status_logs WHERE solicitacao_id = $1 ORDER BY id',
    [id]
  )
  const logConfirmacao = logs.rows.find((row) =>
    String(row.observacao ?? '').includes('Confirmacao de morador registrada')
  )
  assert.ok(logConfirmacao, 'status_logs registra a confirmacao')
  const observacao = String(logConfirmacao.observacao)
  assert.ok(observacao.includes('*****2222'), 'telefone mascarado no log')
  assert.ok(!observacao.includes('999992222'), 'telefone nunca em claro no log')

  const auditoria = await executar(
    `SELECT dados_depois FROM auditoria
      WHERE tabela = 'confirmacoes'
      ORDER BY id DESC LIMIT 1`
  )
  assert.equal(auditoria.rows.length, 1, 'auditoria registra a confirmacao')
  const depois = comoObjeto(auditoria.rows[0].dados_depois)
  assert.equal(depois.telefone_mascarado, '*****2222')
  assert.ok(!('telefone' in depois), 'auditoria sem telefone em claro')
  assert.equal(depois.solicitacao_id, id)
})

test('solicitante original nao conta e o primeiro confirmador nao eleva', async () => {
  const original = await postSolicitacao(
    payload({
      nome_solicitante: 'Rita Moradora',
      telefone: '(69) 99999-3333',
      endereco_informado: 'Rua Morador Dois, 20, Centro',
      tipo_problema: 'lampada_piscando',
    })
  )
  assert.equal(original.status, 201, JSON.stringify(original.json))
  const id = Number(original.json.id)

  const mesmoTelefone = await postSolicitacao(
    payload({
      nome_solicitante: 'Rita Moradora',
      telefone: '(69) 99999-3333',
      endereco_informado: 'Rua Morador Dois, 20, Centro',
      tipo_problema: 'lampada_piscando',
    })
  )
  assert.equal(mesmoTelefone.status, 200, JSON.stringify(mesmoTelefone.json))
  assert.equal(mesmoTelefone.json.confirmacao.registrada, false)
  assert.equal(mesmoTelefone.json.confirmacao.ja_existia, true)
  assert.equal(mesmoTelefone.json.confirmacao.total_moradores, 1)
  assert.equal(mesmoTelefone.json.confirmacao.elevou_prioridade, false)
  assert.equal(await contarConfirmacoes(id), 0, 'telefone original nao gera confirmacao')

  const primeiro = await postSolicitacao(
    payload({
      nome_solicitante: 'Segundo Morador',
      telefone: '(69) 99999-4444',
      endereco_informado: 'Rua Morador Dois, 20, Centro',
      tipo_problema: 'lampada_piscando',
    })
  )
  assert.equal(primeiro.status, 200, JSON.stringify(primeiro.json))
  assert.equal(primeiro.json.confirmacao.registrada, true)
  assert.equal(primeiro.json.confirmacao.total_moradores, 2)
  assert.equal(primeiro.json.confirmacao.elevou_prioridade, false, '1o confirmador nao eleva')

  const sol = await linhaSolicitacao(id)
  assert.equal(sol.prioridade, 'media', 'prioridade permanece a base')
  assert.equal(sol.confirmacoes_elevacao_em, null, 'nenhuma elevacao registrada')
  assert.equal(await contarLogs(id, 'Prioridade elevada'), 0)
})

test('segundo confirmador eleva a prioridade exatamente uma vez', async () => {
  const original = await postSolicitacao(
    payload({
      nome_solicitante: 'Carlos Pedestre',
      telefone: '(69) 99999-5555',
      endereco_informado: 'Rua Elevacao Tres, 30, Centro',
      tipo_problema: 'poste_danificado',
    })
  )
  assert.equal(original.status, 201, JSON.stringify(original.json))
  assert.equal(original.json.prioridade, 'alta')
  const id = Number(original.json.id)

  const primeiro = await postSolicitacao(
    payload({
      telefone: '(69) 99999-6666',
      endereco_informado: 'Rua Elevacao Tres, 30, Centro',
      tipo_problema: 'poste_danificado',
    })
  )
  assert.equal(primeiro.status, 200, JSON.stringify(primeiro.json))
  assert.equal(primeiro.json.confirmacao.total_moradores, 2)
  assert.equal(primeiro.json.confirmacao.elevou_prioridade, false)
  assert.equal((await linhaSolicitacao(id)).prioridade, 'alta')

  const segundo = await postSolicitacao(
    payload({
      telefone: '(69) 99999-7777',
      endereco_informado: 'Rua Elevacao Tres, 30, Centro',
      tipo_problema: 'poste_danificado',
    })
  )
  assert.equal(segundo.status, 200, JSON.stringify(segundo.json))
  assert.equal(segundo.json.confirmacao.total_moradores, 3)
  assert.equal(segundo.json.confirmacao.elevou_prioridade, true, '3 moradores elevam 1 nivel')
  assert.equal(segundo.json.confirmacao.prioridade_anterior, 'alta')
  assert.equal(segundo.json.confirmacao.prioridade_nova, 'urgente')
  assert.equal(segundo.json.prioridade, 'urgente', 'resposta ja reflete a nova prioridade')

  const aposElevacao = await linhaSolicitacao(id)
  assert.equal(aposElevacao.prioridade, 'urgente')
  assert.ok(aposElevacao.confirmacoes_elevacao_em, 'marca de elevacao gravada')

  const terceiro = await postSolicitacao(
    payload({
      telefone: '(69) 99999-8888',
      endereco_informado: 'Rua Elevacao Tres, 30, Centro',
      tipo_problema: 'poste_danificado',
    })
  )
  assert.equal(terceiro.status, 200, JSON.stringify(terceiro.json))
  assert.equal(terceiro.json.confirmacao.total_moradores, 4)
  assert.equal(terceiro.json.confirmacao.elevou_prioridade, false, 'nunca eleva de novo')
  assert.equal(terceiro.json.confirmacao.prioridade_nova, null)
  assert.equal((await linhaSolicitacao(id)).prioridade, 'urgente')

  assert.equal(await contarLogs(id, 'Prioridade elevada'), 1, 'exatamente um log de elevacao')
  assert.equal(await contarConfirmacoes(id), 3)
})

test('estado da OS e exposto sem recriar nem redistribuir na confirmacao', async () => {
  await definirModoOperacional('automatico')
  try {
    const original = await postSolicitacao(
      payload({
        telefone: '(69) 99999-1212',
        endereco_informado: 'Rua Os Confirmada, 50, Centro',
        tipo_problema: 'poste_danificado',
      })
    )
    assert.equal(original.status, 201, JSON.stringify(original.json))
    assert.equal(original.json.fluxo, 'automatico')
    assert.ok(original.json.os_automatica, 'OS criada no modo automatico')
    const id = Number(original.json.id)

    const antes = await executar(
      'SELECT id, status, equipe_id FROM ordens_servico WHERE solicitacao_id = $1',
      [id]
    )
    assert.equal(antes.rows.length, 1, 'uma unica OS para a solicitacao')
    const osAntes = antes.rows[0]

    const primeiro = await postSolicitacao(
      payload({
        telefone: '(69) 99999-1313',
        endereco_informado: 'Rua Os Confirmada, 50, Centro',
        tipo_problema: 'poste_danificado',
      })
    )
    assert.equal(primeiro.status, 200, JSON.stringify(primeiro.json))
    assert.equal(primeiro.json.os.existe, true)
    assert.ok(
      ['em_fila', 'atribuida'].includes(primeiro.json.os.estado),
      `estado valido: ${primeiro.json.os.estado}`
    )
    assert.equal(typeof primeiro.json.os.estado_label, 'string')
    assert.equal(primeiro.json.elegivel_os_automatica, false, 'duplicada nao reentra no fluxo')
    assert.equal(primeiro.json.os_automatica, null)
    assert.equal(primeiro.json.confirmacao.elevou_prioridade, false)

    const segundo = await postSolicitacao(
      payload({
        telefone: '(69) 99999-1414',
        endereco_informado: 'Rua Os Confirmada, 50, Centro',
        tipo_problema: 'poste_danificado',
      })
    )
    assert.equal(segundo.status, 200, JSON.stringify(segundo.json))
    assert.equal(segundo.json.confirmacao.elevou_prioridade, true)
    assert.equal(segundo.json.os.estado, primeiro.json.os.estado, 'estado estavel')

    const depois = await executar(
      'SELECT id, status, equipe_id FROM ordens_servico WHERE solicitacao_id = $1',
      [id]
    )
    assert.equal(depois.rows.length, 1, 'nenhuma OS nova na confirmacao')
    assert.deepEqual(depois.rows[0], osAntes, 'status e equipe da OS preservados')
  } finally {
    await definirModoOperacional('manual')
  }
})

test('confirmacoes simultaneas nunca elevam duas vezes', async () => {
  const original = await postSolicitacao(
    payload({
      telefone: '(69) 99999-1515',
      endereco_informado: 'Rua Simultanea Conf, 60, Centro',
      tipo_problema: 'lampada_apagada',
    })
  )
  assert.equal(original.status, 201, JSON.stringify(original.json))
  const id = Number(original.json.id)

  const [r1, r2] = await Promise.all([
    postSolicitacao(
      payload({
        telefone: '(69) 99999-1616',
        endereco_informado: 'Rua Simultanea Conf, 60, Centro',
        tipo_problema: 'lampada_apagada',
      })
    ),
    postSolicitacao(
      payload({
        telefone: '(69) 99999-1717',
        endereco_informado: 'Rua Simultanea Conf, 60, Centro',
        tipo_problema: 'lampada_apagada',
      })
    ),
  ])

  assert.equal(r1.status, 200, JSON.stringify(r1.json))
  assert.equal(r2.status, 200, JSON.stringify(r2.json))
  assert.equal(await contarConfirmacoes(id), 2, 'dois moradores distintos registrados')

  const elevacoes = [r1.json.confirmacao, r2.json.confirmacao].filter(
    (c) => c && c.elevou_prioridade
  ).length
  assert.ok(elevacoes <= 1, `no maximo uma elevacao (houve ${elevacoes})`)

  const sol = await linhaSolicitacao(id)
  assert.ok(
    ['media', 'alta'].includes(sol.prioridade),
    `nunca dobra a prioridade (ficou ${sol.prioridade})`
  )
  assert.ok((await contarLogs(id, 'Prioridade elevada')) <= 1)
})

test('replay de client_request_id nao registra confirmacao', async () => {
  const clientId = 'confirm-replay-0001'
  const primeira = await postSolicitacao(
    payload({
      client_request_id: clientId,
      telefone: '(69) 99999-1818',
      endereco_informado: 'Rua Replay Confirm, 70, Centro',
      tipo_problema: 'poste_danificado',
    })
  )
  assert.equal(primeira.status, 201, JSON.stringify(primeira.json))
  const id = Number(primeira.json.id)

  const replay = await postSolicitacao(
    payload({
      client_request_id: clientId,
      telefone: '(69) 99999-1919',
      endereco_informado: 'Rua Replay Confirm, 70, Centro',
      tipo_problema: 'poste_danificado',
    })
  )
  assert.equal(replay.status, 200, JSON.stringify(replay.json))
  assertContratoPublico(replay.json)
  assert.equal(replay.json.id, id)
  assert.equal(replay.json.protocolo, primeira.json.protocolo)
  assert.equal(replay.json.duplicada, false)
  assert.equal(replay.json.confirmacao, null, 'replay nao conta como confirmacao')
  assert.equal(await contarConfirmacoes(id), 0)
})

test('anexo da solicitacao original permanece vinculado apos a confirmacao', async () => {
  const original = await postSolicitacao(
    payload({
      telefone: '(69) 99999-2020',
      endereco_informado: 'Rua Anexo Confirm, 80, Centro',
      tipo_problema: 'lampada_piscando',
    })
  )
  assert.equal(original.status, 201, JSON.stringify(original.json))
  const id = Number(original.json.id)

  const form = new FormData()
  form.append('solicitacao_id', String(id))
  form.append('protocolo', String(original.json.protocolo))
  form.append(
    'arquivo',
    new Blob(['foto da luminaria piscando'], { type: 'text/plain' }),
    'luminaria.txt'
  )
  const upload = await fetch(`${baseUrl}/api/anexos/upload-public`, {
    method: 'POST',
    body: form,
  })
  const corpoUpload = await upload.text()
  assert.equal(upload.status, 201, corpoUpload)

  const duplicada = await postSolicitacao(
    payload({
      telefone: '(69) 99999-2121',
      endereco_informado: 'Rua Anexo Confirm, 80, Centro',
      tipo_problema: 'lampada_piscando',
    })
  )
  assert.equal(duplicada.status, 200, JSON.stringify(duplicada.json))
  assert.equal(duplicada.json.id, id)
  assert.equal(duplicada.json.confirmacao.registrada, true)

  const anexos = await executar(
    'SELECT id FROM anexos WHERE solicitacao_id = $1',
    [id]
  )
  assert.equal(anexos.rows.length, 1, 'anexo continua na solicitacao original')
})

test('solicitacao encerrada nao eleva por confirmacoes', async () => {
  const criada = await executar(
    `INSERT INTO solicitacoes
       (protocolo, nome_solicitante, telefone, tipo_problema, status_atual,
        prioridade, endereco_informado, consentimento_lgpd)
     VALUES ($1, $2, $3, 'lampada_apagada', 'concluida', 'media',
             'Rua Encerrada Conf, 90, Centro', TRUE)
     RETURNING id`,
    ['ILX20261113-ENC01', 'Vera Encerrada', '(69) 99999-3003']
  )
  const id = Number(criada.rows[0].id)

  await executar(
    `INSERT INTO confirmacoes (solicitacao_id, telefone_normalizado, origem)
     VALUES ($1, '556999993113', 'portal')`,
    [id]
  )

  const resultado = await registrarConfirmacao({
    solicitacaoId: id,
    telefoneInformado: '(69) 99999-3223',
  })
  assert.ok(resultado, 'confirmacao registrada mesmo encerrada')
  assert.equal(resultado.registrada, true)
  assert.equal(resultado.total_moradores, 3, 'checaria o limiar se estivesse aberta')
  assert.equal(resultado.elevou_prioridade, false, 'encerrada nunca eleva')

  const sol = await linhaSolicitacao(id)
  assert.equal(sol.prioridade, 'media')
  assert.equal(sol.confirmacoes_elevacao_em, null)
  assert.equal(await contarLogs(id, 'Prioridade elevada'), 0)
})

test('duplicidade continua respondendo sem a tabela de confirmacoes', async () => {
  const original = await postSolicitacao(
    payload({
      telefone: '(69) 99999-2424',
      endereco_informado: 'Rua Degradacao Conf, 100, Centro',
      tipo_problema: 'fio_exposto',
    })
  )
  assert.equal(original.status, 201, JSON.stringify(original.json))
  const id = Number(original.json.id)

  await executar('ALTER TABLE confirmacoes RENAME TO confirmacoes_pendente_etapa7')
  try {
    const duplicada = await postSolicitacao(
      payload({
        telefone: '(69) 99999-2525',
        endereco_informado: 'Rua Degradacao Conf, 100, Centro',
        tipo_problema: 'fio_exposto',
      })
    )
    assert.equal(duplicada.status, 200, JSON.stringify(duplicada.json))
    assertContratoPublico(duplicada.json)
    assert.equal(duplicada.json.duplicada, true)
    assert.equal(duplicada.json.id, id)
    assert.equal(duplicada.json.confirmacao, null, 'degrada sem a tabela da Etapa 7')

    const texto = JSON.stringify(duplicada.json)
    assert.ok(!texto.includes('registrada'), 'nao afirma confirmacao registrada')
    assert.ok(!texto.includes('elevou_prioridade'), 'nao afirma elevacao')
    assert.ok(!texto.includes('total_moradores'), 'nao expoe contagem sem registro')
    assert.ok(!texto.includes('*****'), 'nao expoe telefone mascarado')
  } finally {
    await executar(
      'ALTER TABLE confirmacoes_pendente_etapa7 RENAME TO confirmacoes'
    )
  }

  assert.equal(await contarConfirmacoes(id), 0, 'nenhuma confirmacao registrada na degradacao')
})

test('protecao unica por colunas impede duplicidade do mesmo morador', async () => {
  const telefoneMorador = '(69) 99999-4242'
  const normalizado = normalizarTelefone(telefoneMorador)
  assert.ok(normalizado, 'telefone de teste normaliza')

  const original = await postSolicitacao(
    payload({
      telefone: '(69) 99999-4141',
      endereco_informado: 'Rua Indice Unico, 110, Centro',
      tipo_problema: 'risco_eletrico',
    })
  )
  assert.equal(original.status, 201, JSON.stringify(original.json))
  const id = Number(original.json.id)

  await executar(
    `INSERT INTO confirmacoes (solicitacao_id, telefone_normalizado, origem)
     VALUES ($1, $2, 'portal')`,
    [id, normalizado]
  )

  await assert.rejects(() =>
    executar(
      `INSERT INTO confirmacoes (solicitacao_id, telefone_normalizado, origem)
       VALUES ($1, $2, 'portal')`,
      [id, normalizado]
    )
  )

  const resultado = await registrarConfirmacao({
    solicitacaoId: id,
    telefoneInformado: telefoneMorador,
  })
  assert.ok(resultado, 'confirmacao responde mesmo com a linha existente')
  assert.equal(resultado.registrada, false, 'nao registra de novo')
  assert.equal(resultado.ja_existia, true)
  assert.equal(resultado.total_moradores, 2, 'solicitante + morador ja registrado')
  assert.equal(await contarConfirmacoes(id), 1, 'uma unica linha por morador')
})
