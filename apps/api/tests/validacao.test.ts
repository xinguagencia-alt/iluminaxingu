import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TIPOS_PROBLEMA_PERMITIDOS,
  ERRO_POSTE_NAO_ENCONTRADO,
  normalizarEspacos,
  normalizarCampoOpcional,
  normalizarTipoProblema,
  ehTipoPermitido,
  validarNomeCompleto,
  validarTelefone,
  validarEmail,
  validarCoordenadas,
  extrairRuaBairro,
  validarLocalizacao,
  validarSolicitacao,
  primeiraMensagemDeErro,
  garantirSolicitacaoValida,
} from '../src/modules/solicitacoes/validacao.js'

function corpoValido(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    nome_solicitante: 'Maria da Silva',
    telefone: '(69) 99999-0001',
    email: null,
    poste_id: null,
    codigo_poste: null,
    endereco_informado: 'Rua das Flores, 123, Centro',
    latitude: null,
    longitude: null,
    tipo_problema: 'lampada_acesa_dia',
    descricao: null,
    consentimento_lgpd: true,
    ...extra,
  }
}

test('catalogo compartilhado tem exatamente os 6 tipos permitidos', () => {
  assert.deepEqual([...TIPOS_PROBLEMA_PERMITIDOS], [
    'poste_danificado',
    'lampada_apagada',
    'lampada_piscando',
    'lampada_acesa_dia',
    'risco_eletrico',
    'fio_exposto',
  ])
  assert.equal(ehTipoPermitido('outro'), false)
  assert.equal(ehTipoPermitido('enchente'), false)
  assert.equal(ehTipoPermitido(undefined), false)
  assert.equal(ehTipoPermitido('poste_danificado'), true)
  assert.equal(ehTipoPermitido('luminaria_acesa_24h'), true, 'alias continua aceito')
  assert.equal(normalizarTipoProblema('luminaria_acesa_24h'), 'lampada_acesa_dia')
})

test('nome completo exige nome e sobrenome com espacos normalizados', () => {
  const ok = validarNomeCompleto('  Maria   da   Silva  ')
  assert.ok(ok.ok)
  assert.equal(ok.ok && ok.valor, 'Maria da Silva')

  assert.equal(validarNomeCompleto('Maria').ok, false)
  assert.equal(validarNomeCompleto('Maria1').ok, false)
  assert.equal(validarNomeCompleto('   ').ok, false)
  assert.equal(validarNomeCompleto(null).ok, false)
  assert.equal(validarNomeCompleto(123).ok, false)
})

test('telefone aceita 10/11 digitos com DDD e rejeita incompletos', () => {
  const formatado = validarTelefone('(69) 99999-0001')
  assert.ok(formatado.ok)
  assert.equal(formatado.ok && formatado.valor, '69999990001')

  const fixo = validarTelefone('69 3211-4455')
  assert.ok(fixo.ok)
  assert.equal(fixo.ok && fixo.valor, '6932114455')

  assert.equal(validarTelefone('').ok, false)
  assert.equal(validarTelefone('12345').ok, false)
  assert.equal(validarTelefone('699999').ok, false)
  assert.equal(validarTelefone('01 99999-0001').ok, false, 'DDD invalido')
  assert.equal(validarTelefone('69 1234-5678').ok, false, 'numero com inicial invalida')
  assert.equal(validarTelefone('99 99999-9999').ok, false, 'sequencia repetida')
  assert.equal(validarTelefone(null).ok, false)
})

test('telefone valida DDDs brasileiros reais de varias regioes e rejeita DDD inexistente', () => {
  const aceitos: [string, string][] = [
    ['(11) 98888-7777', '11988887777'],
    ['69 99999-0001', '69999990001'],
    ['85 98888-7777', '85988887777'],
    ['91 98888-7777', '91988887777'],
    ['47 98888-7777', '47988887777'],
    ['61 98888-7777', '61988887777'],
    ['79 98888-7777', '79988887777'],
    ['55 98888-7777', '55988887777'],
  ]
  for (const [entrada, esperado] of aceitos) {
    const resultado = validarTelefone(entrada)
    assert.ok(resultado.ok, `${entrada} deveria ser aceito`)
    assert.equal(resultado.ok && resultado.valor, esperado, entrada)
  }

  const inexistentes = ['10', '20', '23', '26', '29', '40', '50', '52', '56', '57', '60', '70', '72', '76', '78', '80', '90']
  for (const ddd of inexistentes) {
    assert.equal(
      validarTelefone(`${ddd} 98888-7777`).ok,
      false,
      `DDD ${ddd} nao existe no Brasil`
    )
  }
})

test('telefone aceita fixo, celular, formatado, +55 e 55 sem sinal com 10/11 digitos', () => {
  const fixo = validarTelefone('69 3211-4455')
  assert.ok(fixo.ok, 'fixo aceito')
  assert.equal(fixo.ok && fixo.valor, '6932114455')

  const fixoFormatado = validarTelefone('(11) 3211-4455')
  assert.ok(fixoFormatado.ok, 'fixo formatado aceito')
  assert.equal(fixoFormatado.ok && fixoFormatado.valor, '1132114455')

  const celular = validarTelefone('11 98888-7777')
  assert.ok(celular.ok, 'celular aceito')
  assert.equal(celular.ok && celular.valor, '11988887777')

  const semFormatacao = validarTelefone('69999990001')
  assert.ok(semFormatacao.ok, 'sem formatacao aceito')
  assert.equal(semFormatacao.ok && semFormatacao.valor, '69999990001')

  const comMais55 = validarTelefone('+55 (11) 98888-7777')
  assert.ok(comMais55.ok, '+55 aceito')
  assert.equal(comMais55.ok && comMais55.valor, '11988887777')

  const comMais55Fixo = validarTelefone('+55 69 3211-4455')
  assert.ok(comMais55Fixo.ok, '+55 com fixo aceito')
  assert.equal(comMais55Fixo.ok && comMais55Fixo.valor, '6932114455')

  const ddiSemSinal = validarTelefone('55 11 98888-7777')
  assert.ok(ddiSemSinal.ok, '55 sem sinal aceito')
  assert.equal(ddiSemSinal.ok && ddiSemSinal.valor, '11988887777')

  const ddiSemSinalFixo = validarTelefone('5569 3211-4455')
  assert.ok(ddiSemSinalFixo.ok, '55 sem sinal com fixo aceito')
  assert.equal(ddiSemSinalFixo.ok && ddiSemSinalFixo.valor, '6932114455')
})

test('telefone rejeita sequencia repetida, DDI invalido e tamanhos invalidos', () => {
  assert.equal(validarTelefone('99 99999-9999').ok, false, 'sequencia repetida')
  assert.equal(validarTelefone('66 66666-6666').ok, false, 'sequencia repetida')
  assert.equal(validarTelefone('56 11 98888-7777').ok, false, '13 digitos com DDI invalido')
  assert.equal(validarTelefone('55 10 98888-7777').ok, false, 'apos o DDI o DDD nao existe')
  assert.equal(validarTelefone('69 99999-00011').ok, false, '12 digitos sem DDI')
  assert.equal(validarTelefone('12345').ok, false, 'curto demais')
  assert.equal(validarTelefone('699999').ok, false, 'curto demais')
  assert.equal(validarTelefone('69 999-0001').ok, false, '9 digitos')
  assert.equal(validarTelefone('').ok, false, 'vazio')
  assert.equal(validarTelefone(null).ok, false, 'nulo')
})

test('e-mail e opcional, mas se vier invalido e rejeitado', () => {
  const ausente = validarEmail(null)
  assert.ok(ausente.ok)
  assert.equal(ausente.ok && ausente.valor, null)

  const vazio = validarEmail('   ')
  assert.ok(vazio.ok)
  assert.equal(vazio.ok && vazio.valor, null)

  const valido = validarEmail('maria@example.com')
  assert.ok(valido.ok)
  assert.equal(valido.ok && valido.valor, 'maria@example.com')

  assert.equal(validarEmail('nao-e-email').ok, false)
  assert.equal(validarEmail('a@b').ok, false)
})

test('coordenadas exigem lat e lng juntas e dentro das faixas', () => {
  const ausentes = validarCoordenadas(null, null)
  assert.ok(ausentes.ok)
  assert.equal(ausentes.ok && ausentes.valor.latitude, null)

  const validas = validarCoordenadas('-1.4558', '-48.5039')
  assert.ok(validas.ok)
  assert.equal(validas.ok && validas.valor.latitude, -1.4558)
  assert.equal(validas.ok && validas.valor.longitude, -48.5039)

  assert.equal(validarCoordenadas(-1.4, null).ok, false)
  assert.equal(validarCoordenadas(null, -48.5).ok, false)
  assert.equal(validarCoordenadas(999, 0).ok, false)
  assert.equal(validarCoordenadas(0, 181).ok, false)
  assert.equal(validarCoordenadas('abc', 0).ok, false)
})

test('parser de endereco extrai rua e bairro do texto livre', () => {
  assert.deepEqual(extrairRuaBairro('Rua das Flores, 123, Centro'), {
    rua: 'Rua das Flores',
    bairro: 'Centro',
  })
  assert.deepEqual(extrairRuaBairro('Avenida Serra, 45, Centro'), {
    rua: 'Avenida Serra',
    bairro: 'Centro',
  })
  assert.deepEqual(extrairRuaBairro('Rua X - Centro'), {
    rua: 'Rua X',
    bairro: 'Centro',
  })
  assert.deepEqual(extrairRuaBairro('Av. Brasil 1000, Centro'), {
    rua: 'Av. Brasil 1000',
    bairro: 'Centro',
  })
  assert.deepEqual(extrairRuaBairro('Travessa do Sol, Centro'), {
    rua: 'Travessa do Sol',
    bairro: 'Centro',
  })
  assert.deepEqual(extrairRuaBairro('Rua A, Bairro: Centro'), {
    rua: 'Rua A',
    bairro: 'Centro',
  })
  assert.deepEqual(extrairRuaBairro('bairro Centro'), {
    rua: null,
    bairro: 'Centro',
  })
  assert.deepEqual(extrairRuaBairro('Rua das Flores'), {
    rua: 'Rua das Flores',
    bairro: null,
  })
  assert.deepEqual(extrairRuaBairro('Rua das Flores, 123'), {
    rua: 'Rua das Flores',
    bairro: null,
  })
  assert.deepEqual(extrairRuaBairro('Centro'), { rua: null, bairro: 'Centro' })
  assert.deepEqual(extrairRuaBairro(''), { rua: null, bairro: null })
  assert.deepEqual(extrairRuaBairro(null), { rua: null, bairro: null })
})

test('endereco so com rua ou so com bairro e rejeitado pela localizacao', () => {
  const soRua = validarLocalizacao({ endereco_informado: 'Rua das Flores' })
  assert.equal(soRua.ok, false)
  assert.equal(soRua.ok === false && soRua.erro, 'Endereco incompleto. Informe a rua e o bairro')

  const soRuaComNumero = validarLocalizacao({
    endereco_informado: 'Rua das Flores, 123',
  })
  assert.equal(soRuaComNumero.ok, false, 'rua + numero sem bairro')
  assert.equal(
    soRuaComNumero.ok === false && soRuaComNumero.erro,
    'Endereco incompleto. Informe a rua e o bairro'
  )

  const soBairro = validarLocalizacao({ endereco_informado: 'Centro' })
  assert.equal(soBairro.ok, false, 'somente bairro')
  assert.equal(
    soBairro.ok === false && soBairro.erro,
    'Endereco incompleto. Informe a rua e o bairro'
  )

  const soBairroRotulado = validarLocalizacao({ endereco_informado: 'bairro Centro' })
  assert.equal(soBairroRotulado.ok, false, 'bairro rotulado sem rua')

  const completo = validarLocalizacao({
    endereco_informado: 'Rua das Flores, 123, Centro',
  })
  assert.equal(completo.ok, true, 'rua + numero + bairro aceito')
})

test('localizacao valida por poste, coordenadas ou endereco com rua e bairro', () => {
  assert.equal(
    validarLocalizacao({ codigo_poste: 'POSTE-001', endereco_informado: null }).ok,
    true
  )
  assert.equal(
    validarLocalizacao({ poste_id: 12, endereco_informado: null }).ok,
    true
  )
  assert.equal(
    validarLocalizacao({ latitude: -1.4, longitude: -48.5 }).ok,
    true
  )
  assert.equal(
    validarLocalizacao({ endereco_informado: 'Rua das Flores, 123, Centro' }).ok,
    true
  )

  assert.equal(
    validarLocalizacao({ endereco_informado: 'Rua das Flores' }).ok,
    false
  )
  assert.equal(validarLocalizacao({}).ok, false)
  assert.equal(
    validarLocalizacao({ latitude: -1.4, longitude: null }).ok,
    false,
    'latitude sem longitude'
  )
  assert.equal(
    validarLocalizacao({ endereco_informado: null }).ok,
    false,
    'nada informado'
  )

  const naoEncontrado = validarLocalizacao({
    codigo_poste: 'SUMIU',
    poste_encontrado: false,
  })
  assert.equal(naoEncontrado.ok, false)
  assert.equal(
    naoEncontrado.ok === false && naoEncontrado.erro,
    ERRO_POSTE_NAO_ENCONTRADO
  )

  assert.equal(validarLocalizacao({ poste_id: 'abc' }).ok, false)
})

test('validarSolicitacao aceita o payload padrao e normaliza os valores', () => {
  const resultado = validarSolicitacao(
    corpoValido({
      nome_solicitante: '  Maria   da   Silva  ',
      telefone: '(69) 99999-0001',
      tipo_problema: 'luminaria_acesa_24h',
      descricao: '   ',
      email: '  maria@example.com  ',
    })
  )

  assert.ok(resultado.ok, JSON.stringify(resultado))
  if (!resultado.ok) return
  assert.equal(resultado.valores.nome_solicitante, 'Maria da Silva')
  assert.equal(resultado.valores.telefone, '69999990001')
  assert.equal(resultado.valores.email, 'maria@example.com')
  assert.equal(resultado.valores.tipo_problema, 'lampada_acesa_dia')
  assert.equal(resultado.valores.descricao, null, 'descricao vazia vira null')
  assert.equal(resultado.valores.endereco_informado, 'Rua das Flores, 123, Centro')
  assert.equal(resultado.valores.latitude, null)
})

test('validarSolicitacao aceita payload sem descricao e sem e-mail', () => {
  const semOpcionais = corpoValido()
  delete semOpcionais.descricao
  delete semOpcionais.email

  const resultado = validarSolicitacao(semOpcionais)
  assert.ok(resultado.ok)
  if (!resultado.ok) return
  assert.equal(resultado.valores.descricao, null)
  assert.equal(resultado.valores.email, null)
})

test('validarSolicitacao agrega todos os erros em portugues claro', () => {
  const resultado = validarSolicitacao({
    nome_solicitante: 'Maria',
    telefone: '123',
    email: 'invalido',
    tipo_problema: 'outro',
    consentimento_lgpd: false,
    endereco_informado: null,
    latitude: null,
    longitude: null,
  })

  assert.equal(resultado.ok, false)
  if (resultado.ok) return
  assert.ok(resultado.erros.length >= 5, JSON.stringify(resultado.erros))
  assert.ok(resultado.erros.some((erro) => /sobrenome/i.test(erro)))
  assert.ok(resultado.erros.some((erro) => /telefone/i.test(erro)))
  assert.ok(resultado.erros.some((erro) => /e-mail/i.test(erro)))
  assert.ok(resultado.erros.some((erro) => /tipo de problema/i.test(erro)))
  assert.ok(resultado.erros.some((erro) => /LGPD/i.test(erro)))
  assert.ok(resultado.erros.some((erro) => /localizacao/i.test(erro)))
  assert.equal(
    primeiraMensagemDeErro(resultado.erros),
    resultado.erros[0],
    'primeira mensagem guia a resposta da API'
  )
})

test('validarSolicitacao rejeita corpo que nao e objeto', () => {
  assert.equal(validarSolicitacao(null).ok, false)
  assert.equal(validarSolicitacao('texto').ok, false)
  assert.equal(validarSolicitacao(undefined).ok, false)
})

test('garantirSolicitacaoValida lanca Error com a mensagem dos erros', () => {
  assert.doesNotThrow(() => garantirSolicitacaoValida(corpoValido()))
  assert.throws(
    () => garantirSolicitacaoValida(corpoValido({ tipo_problema: 'outro' })),
    (erro: unknown) =>
      erro instanceof Error && /Tipo de problema/i.test(erro.message)
  )
  assert.throws(
    () => garantirSolicitacaoValida(corpoValido({ telefone: 'abc' })),
    (erro: unknown) => erro instanceof Error && /telefone/i.test(erro.message)
  )
})

test('helpers de normalizacao tratam tipos errados como vazios', () => {
  assert.equal(normalizarEspacos('  a   b  '), 'a b')
  assert.equal(normalizarEspacos(null), '')
  assert.equal(normalizarEspacos(42), '')
  assert.equal(normalizarCampoOpcional('  '), null)
  assert.equal(normalizarCampoOpcional(' x '), 'x')
  assert.equal(normalizarCampoOpcional(undefined), null)
})
