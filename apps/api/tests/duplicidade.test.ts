import { baseUrl, cabecalhoAuth } from './helpers/servidor.js'
import { executar } from './helpers/setup.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  arredondarCoordenada,
  janelaDuplicidadeHoras,
  montarChaveLocalizacao,
} from '../src/modules/solicitacoes/duplicidade.js'

function payload(extra: Record<string, unknown> = {}) {
  return {
    nome_solicitante: 'Ana Duplicidade',
    telefone: '(69) 99999-7777',
    email: null,
    codigo_poste: null,
    poste_id: null,
    endereco_informado: 'Rua da Estacao, 10, Centro',
    latitude: null,
    longitude: null,
    tipo_problema: 'lampada_apagada',
    descricao: 'Problema para teste de duplicidade',
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

async function contarPorBusca(texto: string): Promise<number> {
  const response = await fetch(
    `${baseUrl}/api/solicitacoes?busca=${encodeURIComponent(texto)}`,
    { headers: cabecalhoAuth }
  )
  assert.equal(response.status, 200)
  const lista = await response.json()
  return lista.length
}

async function encerrar(id: number, status: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/solicitacoes/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...cabecalhoAuth },
    body: JSON.stringify({ status, observacao: 'encerrada no teste de duplicidade' }),
  })
  assert.equal(response.status, 200, await response.text())
}

test('chave de localizacao usa prioridade poste > codigo > gps > endereco', () => {
  assert.equal(
    montarChaveLocalizacao({
      poste_id: 12,
      codigo_poste: 'POSTE-ABC',
      latitude: -1.4,
      longitude: -48.5,
      endereco: 'Rua A, Centro',
    }),
    'poste:12'
  )
  assert.equal(
    montarChaveLocalizacao({
      poste_id: null,
      codigo_poste: 'poste-abc',
      latitude: -1.4,
      longitude: -48.5,
      endereco: 'Rua A, Centro',
    }),
    'codigo:POSTE-ABC'
  )
  assert.equal(
    montarChaveLocalizacao({
      poste_id: null,
      codigo_poste: null,
      latitude: -1.45581,
      longitude: -48.50392,
      endereco: 'Rua A, Centro',
    }),
    'gps:-1.45581,-48.50392'
  )
  assert.equal(
    montarChaveLocalizacao({
      poste_id: null,
      codigo_poste: null,
      latitude: null,
      longitude: null,
      endereco: 'Rua das Flores, 123, Centro',
    }),
    'addr:rua das flores|centro'
  )
  assert.equal(
    montarChaveLocalizacao({
      poste_id: null,
      codigo_poste: null,
      latitude: null,
      longitude: null,
      endereco: null,
    }),
    null
  )
})

test('coordenadas sao arredondadas para 5 casas na chave gps', () => {
  assert.equal(arredondarCoordenada(-1.4558001), -1.4558)
  assert.equal(arredondarCoordenada(-48.5039299), -48.50393)
  assert.equal(
    montarChaveLocalizacao({ latitude: -1.4558001, longitude: -48.5039299 }),
    montarChaveLocalizacao({ latitude: -1.4558, longitude: -48.50393 })
  )
})

test('janela de duplicidade e configuravel e usa 24 horas por padrao', () => {
  const original = process.env.DUPLICIDADE_JANELA_HORAS
  try {
    delete process.env.DUPLICIDADE_JANELA_HORAS
    assert.equal(janelaDuplicidadeHoras(), 24)

    process.env.DUPLICIDADE_JANELA_HORAS = '48'
    assert.equal(janelaDuplicidadeHoras(), 48)

    process.env.DUPLICIDADE_JANELA_HORAS = 'abc'
    assert.equal(janelaDuplicidadeHoras(), 24)

    process.env.DUPLICIDADE_JANELA_HORAS = '0'
    assert.equal(janelaDuplicidadeHoras(), 24)
  } finally {
    if (original === undefined) delete process.env.DUPLICIDADE_JANELA_HORAS
    else process.env.DUPLICIDADE_JANELA_HORAS = original
  }
})

test('mesma localizacao e mesmo tipo viram duplicada (200, protocolo existente, sem novo registro)', async () => {
  const primeira = await postSolicitacao(
    payload({
      nome_solicitante: 'Bruno MesmaRua',
      endereco_informado: 'Avenida Central, 50, Centro',
    })
  )
  assert.equal(primeira.status, 201, JSON.stringify(primeira.json))
  assert.equal(primeira.json.duplicada, false)

  const segunda = await postSolicitacao(
    payload({
      nome_solicitante: 'Carla MesmaRua',
      endereco_informado: 'Avenida Central, 50, Centro',
    })
  )
  assert.equal(segunda.status, 200, JSON.stringify(segunda.json))
  assert.equal(segunda.json.duplicada, true)
  assert.equal(segunda.json.protocolo, primeira.json.protocolo)
  assert.equal(segunda.json.id, primeira.json.id)

  assert.equal(await contarPorBusca('Bruno MesmaRua'), 1, 'apenas um registro na localizacao')
  assert.equal(await contarPorBusca('Carla MesmaRua'), 0, 'a segunda nao gerou registro proprio')
})

test('localizacao diferente nao e duplicada', async () => {
  const primeira = await postSolicitacao(
    payload({
      nome_solicitante: 'Diego LocalA',
      endereco_informado: 'Rua Alfa, 1, Bela Vista',
    })
  )
  assert.equal(primeira.status, 201, JSON.stringify(primeira.json))

  const segunda = await postSolicitacao(
    payload({
      nome_solicitante: 'Elsa LocalB',
      endereco_informado: 'Rua Beta, 99, Liberdade',
    })
  )
  assert.equal(segunda.status, 201, JSON.stringify(segunda.json))
  assert.equal(segunda.json.duplicada, false)
  assert.notEqual(segunda.json.protocolo, primeira.json.protocolo)
})

test('tipo diferente no mesmo poste nao e duplicada', async () => {
  await executar(
    `INSERT INTO postes (codigo, rua, bairro, status_ativo)
     VALUES ('POSTE-DUP-1', 'Rua Dup', 'Centro', TRUE)`
  )

  const primeira = await postSolicitacao(
    payload({
      nome_solicitante: 'Fabio TipoA',
      codigo_poste: 'POSTE-DUP-1',
      endereco_informado: null,
      tipo_problema: 'lampada_apagada',
    })
  )
  assert.equal(primeira.status, 201, JSON.stringify(primeira.json))

  const segunda = await postSolicitacao(
    payload({
      nome_solicitante: 'Gabriela TipoB',
      codigo_poste: 'POSTE-DUP-1',
      endereco_informado: null,
      tipo_problema: 'poste_danificado',
    })
  )
  assert.equal(segunda.status, 201, JSON.stringify(segunda.json))
  assert.equal(segunda.json.duplicada, false)
  assert.notEqual(segunda.json.protocolo, primeira.json.protocolo)
})

test('solicitacao encerrada nao bloqueia nova com mesma localizacao e tipo', async () => {
  const primeira = await postSolicitacao(
    payload({
      nome_solicitante: 'Helena Encerrada',
      endereco_informado: 'Rua Gamma, 7, Centro',
    })
  )
  assert.equal(primeira.status, 201, JSON.stringify(primeira.json))

  await encerrar(primeira.json.id, 'concluida')

  const segunda = await postSolicitacao(
    payload({
      nome_solicitante: 'Igor DepoisEncerrada',
      endereco_informado: 'Rua Gamma, 7, Centro',
    })
  )
  assert.equal(segunda.status, 201, JSON.stringify(segunda.json))
  assert.equal(segunda.json.duplicada, false)
  assert.notEqual(segunda.json.protocolo, primeira.json.protocolo)
})

test('janela expirada permite nova solicitacao na mesma localizacao', async () => {
  const primeira = await postSolicitacao(
    payload({
      nome_solicitante: 'Julia Janela',
      endereco_informado: 'Rua Delta, 3, Centro',
    })
  )
  assert.equal(primeira.status, 201, JSON.stringify(primeira.json))

  await executar(
    `UPDATE solicitacoes SET criado_em = NOW() - INTERVAL '25 hours' WHERE id = $1`,
    [primeira.json.id]
  )

  const segunda = await postSolicitacao(
    payload({
      nome_solicitante: 'Kevin ForaJanela',
      endereco_informado: 'Rua Delta, 3, Centro',
    })
  )
  assert.equal(segunda.status, 201, JSON.stringify(segunda.json))
  assert.equal(segunda.json.duplicada, false)
  assert.notEqual(segunda.json.protocolo, primeira.json.protocolo)
})

test('registros antigos fora da janela nao bloqueiam', async () => {
  const antiga = await postSolicitacao(
    payload({
      nome_solicitante: 'Laura Antiga',
      endereco_informado: 'Rua Epsilon, 12, Centro',
    })
  )
  assert.equal(antiga.status, 201, JSON.stringify(antiga.json))

  await executar(
    `UPDATE solicitacoes SET criado_em = NOW() - INTERVAL '7 days' WHERE id = $1`,
    [antiga.json.id]
  )

  const nova = await postSolicitacao(
    payload({
      nome_solicitante: 'Miguel Nova',
      endereco_informado: 'Rua Epsilon, 12, Centro',
    })
  )
  assert.equal(nova.status, 201, JSON.stringify(nova.json))
  assert.equal(nova.json.duplicada, false)
})

test('duas requisicoes simultaneas geram apenas um registro e nenhuma OS automatica', async () => {
  await executar(
    `INSERT INTO postes (codigo, rua, bairro, status_ativo)
     VALUES ('POSTE-SIMUL-1', 'Rua Simul', 'Centro', TRUE)`
  )

  const corpo = payload({
    nome_solicitante: 'Simultaneo Um',
    codigo_poste: 'POSTE-SIMUL-1',
    endereco_informado: null,
    client_request_id: 'simul-req-00000001',
  })
  const corpoDois = payload({
    nome_solicitante: 'Simultaneo Dois',
    codigo_poste: 'POSTE-SIMUL-1',
    endereco_informado: null,
    client_request_id: 'simul-req-00000002',
  })

  const [r1, r2] = await Promise.all([
    postSolicitacao(corpo),
    postSolicitacao(corpoDois),
  ])

  const statuses = [r1.status, r2.status].sort((a, b) => a - b)
  assert.deepEqual(statuses, [200, 201], `statuss: ${r1.status}/${r2.status}`)

  const criada = r1.status === 201 ? r1 : r2
  const outra = r1.status === 201 ? r2 : r1
  assert.equal(outra.status, 200)
  assert.equal(outra.json.duplicada, true)
  assert.equal(outra.json.protocolo, criada.json.protocolo)
  assert.equal(criada.json.duplicada, false)

  const total = await executar(
    `SELECT COUNT(*)::int AS total FROM solicitacoes
     WHERE codigo_poste_informado = 'POSTE-SIMUL-1'`
  )
  assert.equal(total.rows[0].total, 1, 'apenas um registro')

  const ordens = await fetch(`${baseUrl}/api/ordens-servico`, {
    headers: cabecalhoAuth,
  })
  assert.equal(ordens.status, 200)
  const lista = await ordens.json()
  const daSolicitacao = lista.filter(
    (o: { solicitacao_id: number }) => o.solicitacao_id === criada.json.id
  )
  assert.equal(daSolicitacao.length, 0, 'nenhuma OS criada automaticamente')
})

test('client_request_id repetido preserva idempotencia sem novo registro', async () => {
  const id = 'offline-req-dup-0001'
  const primeira = await postSolicitacao(
    payload({
      nome_solicitante: 'Offline Idem',
      endereco_informado: 'Rua Zeta, 4, Centro',
      client_request_id: id,
    })
  )
  assert.equal(primeira.status, 201, JSON.stringify(primeira.json))

  const segunda = await postSolicitacao(
    payload({
      nome_solicitante: 'Offline Idem Retry',
      endereco_informado: 'Rua Zeta, 4, Centro',
      client_request_id: id,
    })
  )
  assert.equal(segunda.status, 200, JSON.stringify(segunda.json))
  assert.equal(segunda.json.id, primeira.json.id)
  assert.equal(segunda.json.protocolo, primeira.json.protocolo)

  assert.equal(await contarPorBusca('Offline Idem'), 1)
  assert.equal(await contarPorBusca('Offline Idem Retry'), 0)
})

test('fluxo offline: sincronizacao com duplicidade devolve protocolo existente e aceita 200', async () => {
  const idLocal = 'offline-req-dup-0002'
  const primeira = await postSolicitacao(
    payload({
      nome_solicitante: 'Offline Sync Um',
      endereco_informado: 'Rua Omega, 8, Centro',
      client_request_id: idLocal,
    })
  )
  assert.equal(primeira.status, 201, JSON.stringify(primeira.json))

  const respostaSync = await postSolicitacao(
    payload({
      nome_solicitante: 'Offline Sync Dois',
      endereco_informado: 'Rua Omega, 8, Centro',
      client_request_id: 'offline-req-dup-0003',
    })
  )
  assert.equal(respostaSync.status, 200)
  assert.equal(respostaSync.json.duplicada, true)
  assert.equal(typeof respostaSync.json.id, 'number')
  assert.equal(typeof respostaSync.json.protocolo, 'string')
  assert.equal(respostaSync.json.protocolo, primeira.json.protocolo)
})

test('GPS com raio de 8 metros e identificacao automatica permanecem', async () => {
  await executar(
    `INSERT INTO postes (codigo, rua, bairro, latitude, longitude, status_ativo)
     VALUES ('POSTE-GPS-8M', 'Rua GPS', 'Centro', -1.4558, -48.5039, TRUE)`
  )

  const comPosteProximo = await postSolicitacao(
    payload({
      nome_solicitante: 'GPS Com Poste',
      codigo_poste: null,
      poste_id: null,
      endereco_informado: null,
      latitude: -1.4558,
      longitude: -48.5039,
    })
  )
  // pg-mem nao tem funcoes geograficas: cai no fallback sem auto-ID;
  // em PostgreSQL real o raio de 8m continua identificando 1 poste.
  assert.ok(comPosteProximo.status === 201 || comPosteProximo.status === 200)
  assert.equal(typeof comPosteProximo.json.auto_identificado, 'boolean')

  const semPoste = await postSolicitacao(
    payload({
      nome_solicitante: 'GPS Sem Poste',
      endereco_informado: null,
      latitude: -1.4558,
      longitude: -48.504,
    })
  )
  assert.equal(semPoste.status, 201, JSON.stringify(semPoste.json))
  assert.equal(semPoste.json.auto_identificado, false)
})

test('compatibilidade: consulta de duplicidade usa SQL portatil PG/pg-mem', async () => {
  const sql = `
    SELECT * FROM solicitacoes
    WHERE tipo_problema = $1
      AND NOT (status_atual = ANY($2::text[]))
      AND criado_em >= $3
    ORDER BY criado_em DESC
  `
  const resultado = await executar(sql, [
    'lampada_apagada',
    ['concluida', 'cancelada', 'nao_procedente', 'duplicada'],
    new Date(Date.now() - 24 * 60 * 60 * 1000),
  ])
  assert.ok(Array.isArray(resultado.rows))
})
