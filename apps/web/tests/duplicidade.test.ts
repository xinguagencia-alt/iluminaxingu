import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MENSAGEM_DUPLICIDADE_COM_CONFIRMACAO,
  MENSAGEM_DUPLICIDADE_SEM_CONFIRMACAO,
  confirmacaoRegistrada,
  elevouPrioridadeConfirmada,
  mensagemDuplicidade,
  totalMoradoresConfirmados,
} from '../src/components/RequestForm/duplicidade'
import type { ConfirmacaoInfo } from '../src/components/RequestForm/types'

function comConfirmacao(extra: Partial<ConfirmacaoInfo>): ConfirmacaoInfo {
  return {
    registrada: true,
    ja_existia: false,
    total_moradores: 3,
    elevou_prioridade: false,
    prioridade_anterior: null,
    prioridade_nova: null,
    ...extra,
  }
}

test('sem registro no banco a tela mostra apenas a mensagem neutra', () => {
  assert.equal(
    MENSAGEM_DUPLICIDADE_SEM_CONFIRMACAO,
    'Já existe um atendimento em aberto para este problema. Consulte o protocolo para acompanhar.'
  )
  assert.equal(mensagemDuplicidade(null), MENSAGEM_DUPLICIDADE_SEM_CONFIRMACAO)
  assert.equal(confirmacaoRegistrada(null), false)
  assert.equal(totalMoradoresConfirmados(null), null)
  assert.equal(elevouPrioridadeConfirmada(null), false)
})

test('confirmacao exibida somente quando registrada === true', () => {
  const naoRegistrada = comConfirmacao({
    registrada: false,
    ja_existia: true,
    total_moradores: 7,
    elevou_prioridade: true,
  })
  assert.equal(confirmacaoRegistrada(naoRegistrada), false)
  assert.equal(mensagemDuplicidade(naoRegistrada), MENSAGEM_DUPLICIDADE_SEM_CONFIRMACAO)
  assert.equal(totalMoradoresConfirmados(naoRegistrada), null, 'sem contagem sem registro')
  assert.equal(elevouPrioridadeConfirmada(naoRegistrada), false, 'sem elevacao sem registro')

  const registrada = comConfirmacao({
    registrada: true,
    total_moradores: 3,
    elevou_prioridade: true,
    prioridade_anterior: 'alta',
    prioridade_nova: 'urgente',
  })
  assert.equal(confirmacaoRegistrada(registrada), true)
  assert.equal(mensagemDuplicidade(registrada), MENSAGEM_DUPLICIDADE_COM_CONFIRMACAO)
  assert.equal(totalMoradoresConfirmados(registrada), 3)
  assert.equal(elevouPrioridadeConfirmada(registrada), true)
})

test('nenhuma mensagem neutra afirma confirmacao ou elevacao', () => {
  const casos: (ConfirmacaoInfo | null | undefined)[] = [
    null,
    undefined,
    comConfirmacao({ registrada: false, total_moradores: 9, elevou_prioridade: true }),
  ]
  for (const caso of casos) {
    const texto = mensagemDuplicidade(caso)
    assert.ok(
      !/confirmada|confirmou|registrada|elevada|elevou/i.test(texto),
      `mensagem neutra nao pode afirmar registro: ${texto}`
    )
    assert.ok(texto.includes('protocolo'), 'mensagem neutra aponta para o protocolo')
  }
})
