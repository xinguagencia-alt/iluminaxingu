import { baseUrl, cabecalhoAuth, encerrarServico } from './helpers/servidor.js'
import { executar } from './helpers/setup.js'
import { ehErroDeConsultaGpsNaoSuportada } from '../src/modules/solicitacoes/routes.js'
import test from 'node:test'
import assert from 'node:assert/strict'

const NOVO_LABEL = 'Luminária acesa 24 horas'
const VALOR = 'lampada_acesa_dia'
const CLIENT_REQUEST_ID = 'offline-req-00000001'

function payload(extra: Record<string, unknown> = {}) {
  return {
    nome_solicitante: 'Maria da Silva',
    telefone: '(69) 99999-0001',
    email: null,
    codigo_poste: null,
    poste_id: null,
    endereco_informado: 'Rua das Flores, 123, Centro',
    latitude: null,
    longitude: null,
    tipo_problema: VALOR,
    descricao: 'A luminaria fica acesa o dia inteiro',
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

async function getSolicitacoes(query = ''): Promise<any[]> {
  const response = await fetch(`${baseUrl}/api/solicitacoes${query}`, {
    headers: cabecalhoAuth,
  })
  assert.equal(response.status, 200)
  return response.json()
}

function busca(texto: string): string {
  return `?busca=${encodeURIComponent(texto)}`
}

let criada: any
let antiga: any
let protocoloCriado: string

test('endpoint publico de tipos devolve o novo nome', async () => {
  const response = await fetch(`${baseUrl}/api/problem-types`)
  assert.equal(response.status, 200)
  const tipos = await response.json()

  assert.equal(tipos.length, 6)
  assert.ok(!tipos.some((t: { value: string }) => t.value === 'outro'))
  const tipo = tipos.find((t: { value: string }) => t.value === VALOR)
  assert.ok(tipo, 'o defeito continua sendo um tipo valido')
  assert.equal(tipo.label, NOVO_LABEL)
  assert.ok(!JSON.stringify(tipos).includes('acesa durante o dia'))
})

test('solicitacao online com o novo tipo e registrada com protocolo, prioridade e SLA', async () => {
  const { status, json } = await postSolicitacao(
    payload({ client_request_id: CLIENT_REQUEST_ID })
  )

  assert.equal(status, 201, JSON.stringify(json))
  assert.match(json.protocolo, /^ILX\d{8}-[A-Z0-9]+$/)
  assert.equal(json.tipo_problema, VALOR)
  assert.equal(json.prioridade, 'baixa')
  assert.equal(json.status_atual, 'enviada')
  assert.ok(!('consentimento_lgpd' in json), 'consentimento nao sai na resposta publica')
  assert.equal(json.auto_identificado, false)
  assert.ok(json.prazo_sla, 'SLA calculado na resposta')
  assert.equal(json.status_sla, 'dentro_do_prazo')
  assert.ok(json.horas_restantes > 200 && json.horas_restantes <= 240)

  criada = json
  protocoloCriado = json.protocolo
})

test('reenvio com o mesmo client_request_id nao duplica (idempotencia)', async () => {
  const { status, json } = await postSolicitacao(
    payload({ client_request_id: CLIENT_REQUEST_ID })
  )

  assert.equal(status, 200, 'segundo envio devolve o registro existente')
  assert.equal(json.id, criada.id)
  assert.equal(json.protocolo, criada.protocolo)

  const lista = await getSolicitacoes(busca('Maria da Silva'))
  assert.equal(lista.length, 1, 'apenas um registro para o solicitante')
})

test('lista do painel filtra por tipo, alias, busca e status', async () => {
  const porTipo = await getSolicitacoes(`?tipo=${VALOR}`)
  assert.ok(porTipo.some((s) => s.id === criada.id))

  const porAlias = await getSolicitacoes('?tipo=luminaria_acesa_24h')
  assert.deepEqual(
    porAlias.map((s) => s.id).sort(),
    porTipo.map((s) => s.id).sort(),
    'alias devolve o mesmo resultado do valor canonico'
  )

  const porBuscaLabel = await getSolicitacoes(busca('Luminária'))
  assert.ok(
    porBuscaLabel.some((s) => s.id === criada.id),
    'busca pelo nome exibido encontra a solicitacao'
  )

  const porBuscaProtocolo = await getSolicitacoes(busca(protocoloCriado))
  assert.equal(porBuscaProtocolo.length, 1)

  const porStatus = await getSolicitacoes('?status=enviada')
  assert.ok(porStatus.every((s) => s.status_atual === 'enviada'))

  const porPrioridade = await getSolicitacoes('?prioridade=baixa')
  assert.ok(porPrioridade.every((s) => s.prioridade === 'baixa'))

  const incompativel = await getSolicitacoes('?tipo=risco_eletrico')
  assert.ok(!incompativel.some((s) => s.id === criada.id))
})

test('lista exige autenticacao', async () => {
  const response = await fetch(`${baseUrl}/api/solicitacoes`)
  assert.equal(response.status, 401)
})

test('registro antigo com o mesmo valor continua visivel e com SLA', async () => {
  const dozeDiasAtras = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)
  await executar(
    `INSERT INTO solicitacoes
      (protocolo, nome_solicitante, telefone, endereco_informado, tipo_problema,
       status_atual, prioridade, client_request_id, criado_em, atualizado_em)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      'ILX20240101-ANTIGO',
      'Jose dos Reis',
      '(69) 98888-0002',
      'Avenida Serra, 45',
      VALOR,
      'enviada',
      'baixa',
      'registro-antigo-0001',
      dozeDiasAtras,
      dozeDiasAtras,
    ]
  )

  const lista = await getSolicitacoes(busca('Jose dos Reis'))
  assert.equal(lista.length, 1)
  antiga = lista[0]
  assert.equal(antiga.tipo_problema, VALOR)
  assert.equal(antiga.status_sla, 'atrasada', 'registro antigo mantem calculo de SLA')

  const porTipo = await getSolicitacoes(`?tipo=${VALOR}`)
  assert.ok(porTipo.some((s) => s.id === antiga.id))
})

test('demais tipos continuam recebendo a prioridade correta', async () => {
  const risco = await postSolicitacao(
    payload({
      nome_solicitante: 'Ana Paula',
      tipo_problema: 'risco_eletrico',
      endereco_informado: 'Rua Tipos Um, 1, Centro',
    })
  )
  assert.equal(risco.status, 201)
  assert.equal(risco.json.prioridade, 'urgente')

  const poste = await postSolicitacao(
    payload({
      nome_solicitante: 'Bruno Costa',
      tipo_problema: 'poste_danificado',
      endereco_informado: 'Rua Tipos Dois, 2, Centro',
    })
  )
  assert.equal(poste.status, 201)
  assert.equal(poste.json.prioridade, 'alta')

  const apagada = await postSolicitacao(
    payload({
      nome_solicitante: 'Carla Mendes',
      tipo_problema: 'lampada_apagada',
      endereco_informado: 'Rua Tipos Tres, 3, Centro',
    })
  )
  assert.equal(apagada.status, 201)
  assert.equal(apagada.json.prioridade, 'media')

  const alias = await postSolicitacao(
    payload({
      nome_solicitante: 'Diego Alves',
      tipo_problema: 'luminaria_acesa_24h',
      endereco_informado: 'Rua Tipos Quatro, 4, Centro',
    })
  )
  assert.equal(alias.status, 201)
  assert.equal(alias.json.tipo_problema, VALOR, 'alias gravado com o valor canonico')
  assert.equal(alias.json.prioridade, 'baixa')
})

test('fluxo online: consulta publica devolve o tipo e o historico', async () => {
  const response = await fetch(`${baseUrl}/api/solicitacoes/publica/${protocoloCriado}`)
  assert.equal(response.status, 200)
  const corpo = await response.json()

  assert.equal(corpo.solicitacao.tipo_problema, VALOR)
  assert.equal(corpo.solicitacao.protocolo, protocoloCriado)
  assert.ok(Array.isArray(corpo.historico))
  assert.ok(corpo.historico.some((h: { status_novo: string }) => h.status_novo === 'enviada'))
})

test('mudanca de status grava historico e recalcula SLA', async () => {
  const patch = await fetch(`${baseUrl}/api/solicitacoes/${criada.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAuth },
    body: JSON.stringify({ status: 'em_analise', observacao: 'Triagem inicial' }),
  })
  assert.equal(patch.status, 200)

  const historico = await fetch(`${baseUrl}/api/solicitacoes/${criada.id}/historico`, {
    headers: cabecalhoAuth,
  })
  const logs = await historico.json()
  assert.equal(logs.length, 2)
  assert.equal(logs[1].status_novo, 'em_analise')
  assert.equal(logs[1].criado_por, 'admin')

  const atual = await (await fetch(`${baseUrl}/api/solicitacoes/${criada.id}`, {
    headers: cabecalhoAuth,
  })).json()
  assert.equal(atual.status_atual, 'em_analise')
  assert.equal(atual.tipo_problema, VALOR)
})

test('criacao de ordem de servico para a solicitacao', async () => {
  const resposta = await fetch(`${baseUrl}/api/ordens-servico`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAuth },
    body: JSON.stringify({ solicitacao_id: criada.id, equipe_id: 1 }),
  })
  const corpoCriacao = await resposta.text()
  assert.equal(resposta.status, 201, corpoCriacao)
  const ordem = JSON.parse(corpoCriacao)
  assert.equal(ordem.solicitacao_id, criada.id)
  assert.equal(ordem.status, 'aberta')

  const duplicada = await fetch(`${baseUrl}/api/ordens-servico`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAuth },
    body: JSON.stringify({ solicitacao_id: criada.id, equipe_id: 1 }),
  })
  assert.equal(duplicada.status, 409)

  const lista = await (await fetch(`${baseUrl}/api/ordens-servico`, {
    headers: cabecalhoAuth,
  })).json()
  const daSolicitacao = lista.find((o: { id: number }) => o.id === ordem.id)
  assert.ok(daSolicitacao, 'ordem listada no painel')
  assert.equal(daSolicitacao.tipo_problema, VALOR)

  const detalhe = await (await fetch(`${baseUrl}/api/ordens-servico/${ordem.id}/detalhe`, {
    headers: cabecalhoAuth,
  })).json()
  assert.equal(detalhe.ordem.protocolo, protocoloCriado)
  assert.equal(detalhe.ordem.tipo_problema, VALOR)
  assert.ok(detalhe.historico.length >= 1)

  const status = await fetch(`${baseUrl}/api/ordens-servico/${ordem.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAuth },
    body: JSON.stringify({ status: 'concluida', observacao_execucao: 'Lampada substituida' }),
  })
  assert.equal(status.status, 200)

  const depois = await (await fetch(`${baseUrl}/api/solicitacoes/${criada.id}`, {
    headers: cabecalhoAuth,
  })).json()
  assert.equal(depois.status_atual, 'concluida')
  assert.equal(depois.status_sla, 'concluida_no_prazo')
})

test('anexo publico entra na solicitacao e aparece na ordem', async () => {
  const form = new FormData()
  form.append('solicitacao_id', String(criada.id))
  form.append('protocolo', protocoloCriado)
  form.append(
    'arquivo',
    new Blob(['foto da luminaria acesa'], { type: 'text/plain' }),
    'luminaria.txt'
  )

  const resposta = await fetch(`${baseUrl}/api/anexos/upload-public`, {
    method: 'POST',
    body: form,
  })
  const corpoAnexo = await resposta.text()
  assert.equal(resposta.status, 201, corpoAnexo)
  const anexo = JSON.parse(corpoAnexo)
  assert.equal(anexo.solicitacao_id, criada.id)
  assert.equal(anexo.arquivo_nome, 'luminaria.txt')

  const visualizar = await fetch(`${baseUrl}/api/anexos/${anexo.id}/view`, {
    headers: cabecalhoAuth,
  })
  assert.equal(visualizar.status, 200)
  assert.equal(await visualizar.text(), 'foto da luminaria acesa')
})

test('dashboard agrega o tipo novo junto com os demais', async () => {
  const resposta = await fetch(`${baseUrl}/api/dashboard/resumo`, {
    headers: cabecalhoAuth,
  })
  assert.equal(resposta.status, 200)
  const resumo = await resposta.json()

  const porTipo = resumo.por_tipo_problema as { tipo: string; total: number }[]
  const novo = porTipo.find((t) => t.tipo === VALOR)
  assert.ok(novo, 'tipo aparece no dashboard')
  assert.equal(novo.total, 3, 'duas criadas online + um registro antigo')

  const tipos = porTipo.map((t) => t.tipo)
  assert.ok(tipos.includes('risco_eletrico'))
  assert.ok(tipos.includes('poste_danificado'))
  assert.ok(tipos.includes('lampada_apagada'))

  // Total inclui registros de outros arquivos de teste no mesmo banco em memoria
  assert.ok(resumo.contadores.total >= 6, `total ${resumo.contadores.total} >= 6`)
  assert.ok(resumo.ordens.total >= 1)
  assert.ok(resumo.por_status['concluida'] >= 1)
  assert.ok(resumo.por_prioridade['urgente'] >= 1)
})

test('resumo de exportacao conta as solicitacoes', async () => {
  const resposta = await fetch(`${baseUrl}/api/export`, { headers: cabecalhoAuth })
  assert.equal(resposta.status, 200)
  const resumo = await resposta.json()
  assert.ok(resumo.solicitacoes >= 6, `solicitacoes ${resumo.solicitacoes} >= 6`)
  assert.ok(resumo.ordens_servico >= 1)
})

test('exportacao detalhada usa as colunas reais do banco', async () => {
  for (const tabela of ['postes', 'bairros', 'ruas', 'solicitacoes', 'ordens_servico', 'equipes']) {
    const resposta = await fetch(`${baseUrl}/api/export/${tabela}`, {
      headers: cabecalhoAuth,
    })
    assert.equal(resposta.status, 200, `exportacao de ${tabela}`)
    const corpo = await resposta.json()
    assert.equal(corpo.tabela, tabela)
    assert.ok(Array.isArray(corpo.dados))
  }
})

test('health nao expoe detalhes internos do banco', async () => {
  const resposta = await fetch(`${baseUrl}/health`)
  assert.equal(resposta.status, 200)
  const corpo = await resposta.json()
  assert.equal(corpo.database.status, 'ok')
  assert.equal('message' in corpo.database, false)
  assert.equal('solicitacoes_columns' in corpo, false)
  assert.equal('bairros_columns' in corpo, false)
  assert.equal('postes_columns' in corpo, false)
})

test('API rejeita tipo fora do catalogo, inclusive outro', async () => {
  const outro = await postSolicitacao(payload({ tipo_problema: 'outro' }))
  assert.equal(outro.status, 400, JSON.stringify(outro.json))
  assert.match(outro.json.error, /Tipo de problema/i)

  const desconhecido = await postSolicitacao(payload({ tipo_problema: 'enchente' }))
  assert.equal(desconhecido.status, 400)
  assert.match(desconhecido.json.error, /Tipo de problema/i)

  const aliasContinuaAceito = await postSolicitacao(
    payload({ nome_solicitante: 'Hugo Lemes', tipo_problema: 'luminaria_acesa_24h' })
  )
  assert.equal(aliasContinuaAceito.status, 201)
  assert.equal(aliasContinuaAceito.json.tipo_problema, VALOR)
})

test('API rejeita nome, telefone, e-mail e consentimento invalidos', async () => {
  const semSobrenome = await postSolicitacao(payload({ nome_solicitante: 'Maria' }))
  assert.equal(semSobrenome.status, 400)
  assert.match(semSobrenome.json.error, /sobrenome/i)

  const telefoneCurto = await postSolicitacao(payload({ telefone: '12345' }))
  assert.equal(telefoneCurto.status, 400)
  assert.match(telefoneCurto.json.error, /telefone/i)

  const telefoneSemDdd = await postSolicitacao(payload({ telefone: '01 99999-0001' }))
  assert.equal(telefoneSemDdd.status, 400)

  const emailInvalido = await postSolicitacao(payload({ email: 'nao-e-email' }))
  assert.equal(emailInvalido.status, 400)
  assert.match(emailInvalido.json.error, /e-mail/i)

  const semConsentimento = await postSolicitacao(payload({ consentimento_lgpd: false }))
  assert.equal(semConsentimento.status, 400)
  assert.match(semConsentimento.json.error, /LGPD/i)
})

test('API rejeita localizacao ausente, incompleta ou fora das faixas', async () => {
  const semLocalizacao = await postSolicitacao(
    payload({ endereco_informado: null, latitude: null, longitude: null })
  )
  assert.equal(semLocalizacao.status, 400)
  assert.match(semLocalizacao.json.error, /localizacao/i)

  const latitudeSozinha = await postSolicitacao(
    payload({ endereco_informado: null, latitude: -1.4, longitude: null })
  )
  assert.equal(latitudeSozinha.status, 400)
  assert.match(latitudeSozinha.json.error, /juntas/i)

  const enderecoSemBairro = await postSolicitacao(
    payload({ endereco_informado: 'Rua das Flores' })
  )
  assert.equal(enderecoSemBairro.status, 400)
  assert.match(enderecoSemBairro.json.error, /bairro/i)

  const coordenadasForaDeFaixa = await postSolicitacao(
    payload({ endereco_informado: null, latitude: 999, longitude: 0 })
  )
  assert.equal(coordenadasForaDeFaixa.status, 400)
  assert.match(coordenadasForaDeFaixa.json.error, /Coordenadas/i)
})

test('API exige que o poste informado exista no sistema', async () => {
  const inexistente = await postSolicitacao(
    payload({ poste_id: 999999, endereco_informado: null })
  )
  assert.equal(inexistente.status, 400, JSON.stringify(inexistente.json))
  assert.match(inexistente.json.error, /nao encontrado/i)

  const codigoInexistente = await postSolicitacao(
    payload({ codigo_poste: 'NAO-EXISTE', endereco_informado: null })
  )
  assert.equal(codigoInexistente.status, 400)
  assert.match(codigoInexistente.json.error, /nao encontrado/i)

  await executar(
    `INSERT INTO postes (codigo, rua, bairro, status_ativo)
     VALUES ('POSTE-VALIDACAO-1', 'Rua das Flores', 'Centro', TRUE)`
  )

  const existente = await postSolicitacao(
    payload({ nome_solicitante: 'Gilda Rocha', codigo_poste: 'POSTE-VALIDACAO-1', endereco_informado: null })
  )
  assert.equal(existente.status, 201, JSON.stringify(existente.json))
  const posteSalvo = await executar(
    'SELECT codigo_poste_informado, poste_id FROM solicitacoes WHERE id = $1',
    [existente.json.id]
  )
  assert.equal(posteSalvo.rows[0].codigo_poste_informado, 'POSTE-VALIDACAO-1')
  assert.ok(posteSalvo.rows[0].poste_id, 'poste resolvido para o registro')
})

test('API aceita coordenadas validas mesmo sem poste proximo', async () => {
  const resposta = await postSolicitacao(
    payload({
      nome_solicitante: 'Fabio Gomes',
      endereco_informado: null,
      latitude: -1.4558,
      longitude: -48.5039,
    })
  )
  assert.equal(resposta.status, 201, JSON.stringify(resposta.json))
  assert.equal(resposta.json.auto_identificado, false)
  const coordenadasSalvas = await executar(
    'SELECT latitude, longitude FROM solicitacoes WHERE id = $1',
    [resposta.json.id]
  )
  assert.equal(Number(coordenadasSalvas.rows[0].latitude), -1.4558)
  assert.equal(Number(coordenadasSalvas.rows[0].longitude), -48.5039)
})

test('descricao continua opcional e vazia vira null', async () => {
  const semDescricao = await postSolicitacao(
    payload({
      nome_solicitante: 'Iara Nogueira',
      descricao: null,
      endereco_informado: 'Rua Desc Um, 10, Centro',
    })
  )
  assert.equal(semDescricao.status, 201)
  const semDescricaoSalva = await executar(
    'SELECT descricao FROM solicitacoes WHERE id = $1',
    [semDescricao.json.id]
  )
  assert.equal(semDescricaoSalva.rows[0].descricao, null)

  const descricaoVazia = await postSolicitacao(
    payload({
      nome_solicitante: 'Joao Pires',
      descricao: '   ',
      endereco_informado: 'Rua Desc Dois, 20, Centro',
    })
  )
  assert.equal(descricaoVazia.status, 201)
  const descricaoVaziaSalva = await executar(
    'SELECT descricao FROM solicitacoes WHERE id = $1',
    [descricaoVazia.json.id]
  )
  assert.equal(descricaoVaziaSalva.rows[0].descricao, null)
})

test('catch da consulta GPS so engole funcoes nao suportadas', () => {
  assert.equal(
    ehErroDeConsultaGpsNaoSuportada(
      'ERROR: function radians(text) does not exist\nHINT: funcao nao implementada'
    ),
    true,
    'pg-mem: funcao geografica ausente cai no fallback'
  )
  assert.equal(
    ehErroDeConsultaGpsNaoSuportada(
      new Error('function radians(numeric) does not exist')
    ),
    true,
    'PostgreSQL real: funcao ausente cai no fallback'
  )
  assert.equal(
    ehErroDeConsultaGpsNaoSuportada('operator does not exist: double precision * unknown'),
    true,
    'operador ausente cai no fallback'
  )
  assert.equal(
    ehErroDeConsultaGpsNaoSuportada('ERROR: unsupported join type'),
    true
  )

  assert.equal(
    ehErroDeConsultaGpsNaoSuportada('connection to server was lost'),
    false,
    'falha de rede nao pode virar fallback silencioso'
  )
  assert.equal(
    ehErroDeConsultaGpsNaoSuportada(new Error('relation "postes" does not exist')),
    false,
    'erro de esquema nao pode virar fallback silencioso'
  )
  assert.equal(
    ehErroDeConsultaGpsNaoSuportada('syntax error at or near "SELECT"'),
    false
  )
})

test('prioridade sobe com 3 abertas e somente abertas contam no recalculo', async () => {
  await executar(
    `INSERT INTO postes (codigo, rua, bairro, status_ativo)
     VALUES ('POSTE-PRIORIDADE-1', 'Avenida Central', 'Centro', TRUE)`
  )
  const posteRow = await executar(
    `SELECT id FROM postes WHERE codigo = 'POSTE-PRIORIDADE-1'`
  )
  const postePrioridade = Number(posteRow.rows[0].id)

  // Semeia 3 abertas via SQL com tipo lampada_piscando.
  // A API nao permite 3 abertas iguais (duplicidade); a contagem de prioridade
  // e por poste e independe do tipo.
  for (let i = 1; i <= 3; i++) {
    await executar(
      `INSERT INTO solicitacoes
        (protocolo, nome_solicitante, telefone, poste_id, codigo_poste_informado,
         tipo_problema, status_atual, prioridade, consentimento_lgpd)
       VALUES ($1, $2, $3, $4, $5, $6, 'enviada', 'media', TRUE)`,
      [
        `ILX20250101-SEED0${i}`,
        `Seed Prioridade ${i}`,
        '(69) 99999-000${i}',
        postePrioridade,
        'POSTE-PRIORIDADE-1',
        'lampada_piscando',
      ]
    )
  }

  const base = {
    codigo_poste: 'POSTE-PRIORIDADE-1',
    endereco_informado: null,
    tipo_problema: 'lampada_apagada',
  }

  // 4a via API com 3 abertas → media sobe para alta (tipo diferente dos seeds evita duplicidade)
  const quarta = await postSolicitacao(
    payload({ nome_solicitante: 'Tereza Luz', ...base })
  )
  assert.equal(quarta.status, 201, JSON.stringify(quarta.json))
  assert.equal(
    quarta.json.prioridade,
    'alta',
    '4a: 3 abertas → media sobe para alta'
  )

  // Encerra os 3 seeds → resta apenas a 4a aberta
  await executar(
    `UPDATE solicitacoes SET status_atual = 'concluida', atualizado_em = NOW()
     WHERE codigo_poste_informado = 'POSTE-PRIORIDADE-1'
       AND nome_solicitante LIKE 'Seed Prioridade%'`
  )

  // 5a via API com 1 aberta (a 4a) → sem elevacao, permanece media
  const quinta = await postSolicitacao(
    payload({
      nome_solicitante: 'Ulisses Pires',
      ...base,
      tipo_problema: 'lampada_piscando',
    })
  )
  assert.equal(quinta.status, 201, JSON.stringify(quinta.json))
  assert.equal(
    quinta.json.prioridade,
    'media',
    '5a: com 3 encerradas fora, resta 1 aberta → volta a media'
  )

  const detalheQuarta = await (
    await fetch(`${baseUrl}/api/solicitacoes/${quarta.json.id}`, {
      headers: cabecalhoAuth,
    })
  ).json()
  assert.equal(detalheQuarta.status_atual, 'enviada', 'a 4a continua aberta')
})

test('encerra o servidor de teste', async () => {
  await encerrarServico()
})
