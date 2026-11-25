import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizarCatalogoLocalidades, rotuloLocalidade } from '../src/localidades'

test('rotulo de localidade identifica tipo e nome', () => {
  assert.equal(rotuloLocalidade('Vila Nova', 'vila'), 'Vila — Vila Nova')
  assert.equal(rotuloLocalidade('Distrito do Rio', 'distrito'), 'Distrito — Distrito do Rio')
})

test('registros antigos sem localidade recebem rótulo explícito', () => {
  assert.equal(rotuloLocalidade(null, null), 'Localidade não informada')
  assert.equal(rotuloLocalidade('', 'sede'), 'Localidade não informada')
})

test('catálogo aceita somente localidades ativas e tipos reconhecidos', () => {
  assert.deepEqual(
    normalizarCatalogoLocalidades([
      { id: 1, nome: 'Sede', tipo: 'sede', ativo: true },
      { id: 2, nome: 'Inativa', tipo: 'vila', ativo: false },
      { id: 0, nome: 'ID inválido', tipo: 'distrito', ativo: true },
    ]),
    [{ id: 1, nome: 'Sede', tipo: 'sede', ativo: true }]
  )
})
