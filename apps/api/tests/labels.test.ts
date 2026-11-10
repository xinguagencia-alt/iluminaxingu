import './helpers/setup.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TIPOS_PROBLEMA } from '../src/modules/solicitacoes/tipos.js'

const NOVO_LABEL = 'Luminária acesa 24 horas'
const LABEL_ANTIGO = 'acesa durante o dia'
const VALOR = 'lampada_acesa_dia'

const raizRepo = fileURLToPath(new URL('../../../', import.meta.url))

function ler(relativo: string, base: string = raizRepo): string {
  return readFileSync(join(base, relativo), 'utf8')
}

function arquivosDe(origem: string, acumulado: string[] = []): string[] {
  for (const entrada of readdirSync(origem)) {
    const caminho = join(origem, entrada)
    if (statSync(caminho).isDirectory()) {
      if (['node_modules', 'dist', '.git', 'tests'].includes(entrada)) continue
      arquivosDe(caminho, acumulado)
    } else if (/\.(ts|tsx|js|jsx|html|css|json|md)$/.test(entrada)) {
      acumulado.push(caminho)
    }
  }
  return acumulado
}

test('API e frontend usam o mesmo valor interno', () => {
  const valorApi = TIPOS_PROBLEMA.find((t) => t.label === NOVO_LABEL)?.value
  assert.equal(valorApi, VALOR)

  const form = ler('apps/web/src/components/RequestForm/types.ts')
  assert.ok(form.includes(`value: '${VALOR}'`), 'formulario do municipe mantem o valor interno')
  assert.ok(form.includes(`label: '${NOVO_LABEL}'`), 'formulario do municipe exibe o novo nome')
})

test('todos os pontos de exibicao do painel mostram o novo nome', () => {
  const pontos = [
    'apps/web/src/components/SolicitacaoList/types.ts',
    'apps/web/src/components/Dashboard/Dashboard.tsx',
    'apps/web/src/components/PendingLocal/PendingLocal.tsx',
    'apps/web/src/components/RequestForm/types.ts',
  ]

  for (const arquivo of pontos) {
    const conteudo = ler(arquivo)
    assert.ok(
      conteudo.includes(`${VALOR}: '${NOVO_LABEL}'`) ||
        conteudo.includes(`${VALOR}', label: '${NOVO_LABEL}'`),
      `${arquivo} deve mapear ${VALOR} para "${NOVO_LABEL}"`
    )
  }
})

test('nenhum codigo fonte ainda usa o nome antigo', () => {
  const pastas = [join(raizRepo, 'apps'), join(raizRepo, 'deploy'), join(raizRepo, 'scripts')]
  const comNomeAntigo: string[] = []

  for (const pasta of pastas) {
    for (const arquivo of arquivosDe(pasta)) {
      const conteudo = readFileSync(arquivo, 'utf8')
      if (conteudo.toLowerCase().includes(LABEL_ANTIGO)) {
        comNomeAntigo.push(arquivo)
      }
    }
  }

  assert.deepEqual(comNomeAntigo, [], `nome antigo ainda presente em: ${comNomeAntigo.join(', ')}`)
})

test('copia da API usada no deploy esta sincronizada com apps/api', () => {
  const arquivos = [
    'src/app.ts',
    'src/modules/solicitacoes/routes.ts',
    'src/modules/solicitacoes/prioridade.ts',
    'src/modules/solicitacoes/tipos.ts',
  ]

  for (const arquivo of arquivos) {
    const origem = ler(`apps/api/${arquivo}`)
    const deploy = ler(`deploy/api/${arquivo}`)
    assert.equal(deploy, origem, `deploy/api/${arquivo} deve ser identico a apps/api/${arquivo}`)
  }
})

test('painel da prefeitura filtra e busca pelo tipo de problema', () => {
  const lista = ler('apps/web/src/components/SolicitacaoList/SolicitacaoList.tsx')
  const hook = ler('apps/web/src/components/SolicitacaoList/useSolicitacoes.ts')

  assert.ok(lista.includes(`setFiltro('tipo'`), 'painel possui seletor de tipo')
  assert.ok(hook.includes(`params.set('tipo'`), 'hook envia o filtro tipo para a API')
  assert.ok(hook.includes('tipo: string'), 'filtro tipo faz parte do estado')
})

test('modo offline carrega o tipo sem restricao e o exibe com o novo nome', () => {
  const tiposOffline = ler('apps/web/src/offline/types.ts')
  const fila = ler('apps/web/src/offline/queue.ts')
  const sync = ler('apps/web/src/offline/sync.ts')

  assert.ok(tiposOffline.includes('tipo_problema: string'), 'payload offline aceita qualquer tipo')
  assert.ok(fila.includes('payload'), 'a fila guarda o payload original')
  assert.ok(sync.includes('...item.payload'), 'a sincronizacao reenvia o payload original')
  assert.ok(sync.includes('client_request_id: item.id_local'), 'sincronizacao mantem idempotencia')

  const pendentes = ler('apps/web/src/components/PendingLocal/PendingLocal.tsx')
  assert.ok(pendentes.includes(`${VALOR}: '${NOVO_LABEL}'`), 'fila offline exibe o novo nome')
})

test('o nome novo aparece tambem na consulta publica e na ordem de servico', () => {
  const publica = ler('apps/web/src/components/SolicitacaoPublica/SolicitacaoPublica.tsx')
  const ordem = ler('apps/web/src/components/OrdemServicoDetail/OrdemServicoDetail.tsx')

  assert.ok(publica.includes('TIPOS_PROBLEMA['), 'consulta publica usa o mapa de tipos')
  assert.ok(ordem.includes('TIPOS_PROBLEMA['), 'ordem de servico usa o mapa de tipos')
})
