import './helpers/setup.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TIPOS_PROBLEMA,
  normalizarTipoProblema,
  labelTipoProblema,
  tiposProblemaQueContem,
} from '../src/modules/solicitacoes/tipos.js'
import { ehTipoPermitido } from '../src/modules/solicitacoes/validacao.js'
import { calcularPrioridadeBase } from '../src/modules/solicitacoes/prioridade.js'
import { calcularPrazoSla, calcularStatusSla } from '../src/modules/solicitacoes/sla.js'

const NOVO_LABEL = 'Luminária acesa 24 horas'
const VALOR_CANONICO = 'lampada_acesa_dia'

test('catalogo de tipos mantem os 6 defeitos validos', () => {
  assert.equal(TIPOS_PROBLEMA.length, 6)
  assert.deepEqual(
    TIPOS_PROBLEMA.map((t) => t.value),
    [
      'poste_danificado',
      'lampada_apagada',
      'lampada_piscando',
      'lampada_acesa_dia',
      'risco_eletrico',
      'fio_exposto',
    ]
  )
})

test('outro saiu do catalogo e e rejeitado no envio', () => {
  assert.ok(!TIPOS_PROBLEMA.some((t) => t.value === 'outro'))
  assert.equal(ehTipoPermitido('outro'), false)
  assert.equal(ehTipoPermitido('tipo_inexistente'), false)
  assert.equal(ehTipoPermitido(VALOR_CANONICO), true)
  assert.equal(ehTipoPermitido('luminaria_acesa_24h'), true, 'alias continua aceito')
  assert.equal(labelTipoProblema('outro'), 'outro', 'leitura de registro antigo preservada')
})

test('o tipo exibe o novo nome para o municipe', () => {
  const tipo = TIPOS_PROBLEMA.find((t) => t.value === VALOR_CANONICO)
  assert.ok(tipo, 'tipo lampada_acesa_dia deve existir no catalogo')
  assert.equal(tipo.label, NOVO_LABEL)
})

test('o valor interno continua sendo o registro antigo', () => {
  assert.equal(normalizarTipoProblema('lampada_acesa_dia'), 'lampada_acesa_dia')
  assert.equal(normalizarTipoProblema('  lampada_acesa_dia  '), 'lampada_acesa_dia')
})

test('alias novo e aceito e normalizado para o valor canonico', () => {
  assert.equal(normalizarTipoProblema('luminaria_acesa_24h'), VALOR_CANONICO)
  assert.equal(normalizarTipoProblema('Luminaria_acesa_24h'.toLowerCase()), VALOR_CANONICO)
})

test('valor que nao e texto vira string vazia (rejeitado na rota)', () => {
  assert.equal(normalizarTipoProblema(undefined), '')
  assert.equal(normalizarTipoProblema(null), '')
  assert.equal(normalizarTipoProblema(123), '')
  assert.equal(normalizarTipoProblema({ value: 'x' }), '')
})

test('label resolve valor canonico, alias e valor desconhecido', () => {
  assert.equal(labelTipoProblema('lampada_acesa_dia'), NOVO_LABEL)
  assert.equal(labelTipoProblema('luminaria_acesa_24h'), NOVO_LABEL)
  assert.equal(labelTipoProblema('tipo_inexistente'), 'tipo_inexistente')
  assert.equal(labelTipoProblema(''), '')
})

test('busca por texto encontra o tipo pelo nome exibido', () => {
  assert.deepEqual(tiposProblemaQueContem('Luminária'), [VALOR_CANONICO])
  assert.deepEqual(tiposProblemaQueContem('luminaria'), [VALOR_CANONICO])
  assert.deepEqual(tiposProblemaQueContem('acesa 24'), [VALOR_CANONICO])
  assert.ok(tiposProblemaQueContem('lampada_acesa_dia').includes(VALOR_CANONICO))
  assert.deepEqual(tiposProblemaQueContem(''), [])
  assert.deepEqual(tiposProblemaQueContem('   '), [])
  assert.ok(tiposProblemaQueContem('poste').includes('poste_danificado'))
  assert.ok(!tiposProblemaQueContem('risco').includes(VALOR_CANONICO))
})

test('prioridade base preserva as regras dos demais tipos', () => {
  assert.equal(calcularPrioridadeBase('risco_eletrico'), 'urgente')
  assert.equal(calcularPrioridadeBase('fio_exposto'), 'urgente')
  assert.equal(calcularPrioridadeBase('poste_danificado'), 'alta')
  assert.equal(calcularPrioridadeBase('lampada_apagada'), 'media')
  assert.equal(calcularPrioridadeBase('lampada_piscando'), 'media')
  assert.equal(calcularPrioridadeBase('outro'), 'baixa')
})

test('luminaria acesa 24 horas recebe prioridade e SLA de baixa', () => {
  assert.equal(calcularPrioridadeBase('lampada_acesa_dia'), 'baixa')
  assert.equal(calcularPrioridadeBase('luminaria_acesa_24h'), 'baixa')

  const criadoEm = new Date()
  const prazo = calcularPrazoSla('baixa', criadoEm)
  const horas = (prazo.getTime() - criadoEm.getTime()) / (1000 * 60 * 60)
  assert.equal(Math.round(horas), 240)

  const sla = calcularStatusSla({
    prioridade: 'baixa',
    criado_em: criadoEm,
    status_atual: 'enviada',
    atualizado_em: criadoEm,
  })
  assert.equal(sla.status_sla, 'dentro_do_prazo')
  assert.ok(sla.horas_restantes !== null && sla.horas_restantes > 200)
})

test('SLA das outras prioridades continua inalterado', () => {
  const agora = new Date()
  const prazos: Record<string, number> = { urgente: 24, alta: 48, media: 120, baixa: 240 }
  for (const [prioridade, horas] of Object.entries(prazos)) {
    const prazo = calcularPrazoSla(prioridade, agora)
    const calculado = (prazo.getTime() - agora.getTime()) / (1000 * 60 * 60)
    assert.equal(Math.round(calculado), horas, `SLA de ${prioridade}`)
  }
})
