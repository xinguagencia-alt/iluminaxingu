import test from 'node:test'
import assert from 'node:assert/strict'
import {
  localidadesDoTipo,
  normalizarLocalidades,
  selecaoAposTrocarTipo,
  validarSelecaoLocalidade,
  type LocalidadeOpcao,
} from '../src/components/RequestForm/localidadeForm'

const localidades: LocalidadeOpcao[] = [
  { id: 1, nome: 'Sede municipal', tipo: 'sede' },
  { id: 2, nome: 'Distrito do Rio', tipo: 'distrito' },
  { id: 3, nome: 'Vila Nova', tipo: 'vila' },
]

test('normaliza o catálogo e descarta registros inválidos ou inativos', () => {
  const result = normalizarLocalidades([
    { id: 1, nome: 'Sede', tipo: 'sede', ativo: true },
    { id: 2, nome: 'Inativa', tipo: 'vila', ativo: false },
    { id: 0, nome: 'ID inválido', tipo: 'vila', ativo: true },
    { id: 3, nome: '', tipo: 'distrito', ativo: true },
    { id: 4, nome: 'Tipo inválido', tipo: 'bairro', ativo: true },
  ])
  assert.deepEqual(result, [{ id: 1, nome: 'Sede', tipo: 'sede', ativo: true }])
})

test('filtra opções pela seleção única de tipo', () => {
  assert.deepEqual(localidadesDoTipo(localidades, 'distrito'), [localidades[1]])
  assert.deepEqual(localidadesDoTipo(localidades, 'bairro'), [])
})

test('trocar tipo limpa a localidade selecionada anteriormente', () => {
  assert.deepEqual(selecaoAposTrocarTipo('distrito'), {
    tipoLocalidade: 'distrito',
    localidadeId: '',
  })
})

test('exige tipo e localidade quando existe catálogo ativo', () => {
  assert.match(validarSelecaoLocalidade('', '', localidades, 'pronto') ?? '', /Selecione o tipo/)
  assert.match(validarSelecaoLocalidade('vila', '', localidades, 'pronto') ?? '', /Selecione o tipo/)
  assert.equal(validarSelecaoLocalidade('vila', '3', localidades, 'pronto'), null)
})

test('rejeita localidade que não corresponde ao tipo selecionado', () => {
  assert.match(validarSelecaoLocalidade('vila', '2', localidades, 'pronto') ?? '', /nao corresponde/)
  assert.match(validarSelecaoLocalidade('vila', '99', localidades, 'pronto') ?? '', /nao esta mais disponivel/)
})

test('catálogo vazio ou indisponível permite continuar sem localidade e explica seleção residual', () => {
  assert.equal(validarSelecaoLocalidade('', '', [], 'pronto'), null)
  assert.equal(validarSelecaoLocalidade('', '', [], 'erro'), null)
  assert.match(validarSelecaoLocalidade('sede', '1', [], 'erro') ?? '', /Limpe a selecao/)
  assert.match(validarSelecaoLocalidade('', '', [], 'carregando') ?? '', /Aguarde/)
})
