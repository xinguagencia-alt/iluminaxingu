import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function ler(caminho: string): string {
  return readFileSync(fileURLToPath(new URL(caminho, import.meta.url)), 'utf8')
}

function semComentarios(sql: string): string {
  return sql
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('--'))
    .join('\n')
}

const migration = ler('../../../scripts/migration-etapa7-confirmacoes.sql')
const precheck = ler('../../../scripts/precheck-etapa7-confirmacoes.sql')
const schemaTs = ler('../src/schema.ts')

const codigoMigration = semComentarios(migration)
const codigoPrecheck = semComentarios(precheck)

test('migration protege a unicidade por definicao das colunas e nao por nome', () => {
  assert.ok(
    migration.includes("ARRAY['solicitacao_id', 'telefone_normalizado']"),
    'alvo declarado como par de colunas'
  )
  assert.ok(/indisunique/.test(migration), 'confere se o indice e unico')
  assert.ok(/indisvalid/.test(migration), 'confere se o indice e valido')
  assert.ok(/indpred IS NULL/.test(migration), 'rejeita indice parcial')
  assert.ok(/indexprs IS NULL/.test(migration), 'rejeita indice por expressao')
  assert.ok(/indnkeyatts/.test(migration), 'considera apenas colunas-chave')
  assert.ok(
    migration.includes('RAISE EXCEPTION'),
    'falha claramente em vez de pular em silencio'
  )
  assert.ok(
    migration.includes("to_regclass('public.' || v_nome)"),
    'detecta conflito de nome em todo o schema'
  )
  assert.ok(
    !/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS/i.test(migration),
    'nao cria indice unico decidindo pelo nome'
  )
  assert.ok(
    /EXECUTE\s+format\(\s*'CREATE UNIQUE INDEX %I/.test(migration.replace(/\n/g, ' ')),
    'criacao condicionada a analise do catalogo'
  )
})

test('migration nao remove objetos nem dados e nao toca em PostGIS', () => {
  assert.ok(!/\bDROP\s+(TABLE|INDEX|CONSTRAINT|SCHEMA|VIEW|DATABASE)\b/i.test(codigoMigration))
  assert.ok(!/\bTRUNCATE\b/i.test(codigoMigration))
  assert.ok(!/\bDELETE\s+FROM\b/i.test(codigoMigration))
  assert.ok(!/\bUPDATE\s+\w+\s+SET\b/i.test(codigoMigration))
  assert.ok(!/\bCREATE\s+EXTENSION\b/i.test(codigoMigration))
  assert.ok(!/\bCREATE\s+TABLE\b(?!\s+IF\s+NOT\s+EXISTS)/i.test(codigoMigration))
  assert.ok(/BEGIN;/.test(migration) && /COMMIT;/.test(migration), 'transacao unica')
  assert.ok(/CREATE TABLE IF NOT EXISTS public\.confirmacoes/.test(migration))
  assert.ok(/ADD COLUMN IF NOT EXISTS confirmacoes_elevacao_em/.test(migration))
})

test('migration mantem RLS e revoga anon, authenticated e PUBLIC', () => {
  assert.ok(
    /ALTER TABLE public\.confirmacoes ENABLE ROW LEVEL SECURITY/.test(migration),
    'RLS habilitado'
  )
  assert.ok(!/FORCE ROW LEVEL SECURITY/i.test(migration), 'nao força RLS sobre o dono')
  assert.ok(
    /REVOKE ALL ON public\.confirmacoes FROM anon, authenticated, PUBLIC/.test(migration),
    'revoga tambem PUBLIC na tabela'
  )
  assert.ok(
    /REVOKE ALL ON SEQUENCE public\.confirmacoes_id_seq FROM anon, authenticated, PUBLIC/.test(
      migration
    ),
    'revoga tambem PUBLIC na sequence'
  )
  assert.ok(!/\bGRANT\s/i.test(codigoMigration), 'nenhum grant novo')
})

test('ensureDatabaseSchema nao cria a tabela da Etapa 7', () => {
  assert.ok(
    !schemaTs.includes('confirmacoes'),
    'schema.ts nao referencia a tabela nem a coluna'
  )
  assert.ok(
    !schemaTs.includes('confirmacoes_elevacao_em'),
    'coluna de elevacao fora do ensureDatabaseSchema'
  )
})

test('pre-check cobre indice equivalente por colunas e grants PUBLIC', () => {
  assert.ok(precheck.includes('protecao_equivalente'), 'indice julgado por definicao')
  assert.ok(precheck.includes('predicado_parcial'), 'predicate parcial conferido')
  assert.ok(precheck.includes('tem_expressao'), 'expressao conferida')
  assert.ok(precheck.includes('conflito_de_nome'), 'conflito de nome reportado')
  assert.ok(precheck.includes("ARRAY['solicitacao_id', 'telefone_normalizado']"))
  assert.ok(precheck.includes("d.grantee IN ('anon', 'authenticated', 'PUBLIC'"))
  assert.ok(precheck.includes('role_table_grants'), 'leitura de grants por papel')
  assert.ok(precheck.includes('rls_ativo') && precheck.includes('rls_forcado'))
  assert.ok(precheck.includes("column_name = 'confirmacoes_elevacao_em'"))
  assert.ok(precheck.includes('abertas_elegiveis'), 'contagem sem dado pessoal')
  assert.ok(
    !/\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|BEGIN|COMMIT)\b/i.test(
      codigoPrecheck
    ),
    'pre-check permanece somente leitura'
  )
})
