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

const migration = ler('../../../scripts/migration-localidades.sql')
const schemaTs = ler('../src/schema.ts')
const deploySchemaTs = ler('../../../deploy/api/src/schema.ts')

const codigoMigration = semComentarios(migration)

test('migration cria localidades antes da FK em solicitacoes (ordem correta)', () => {
  const idxTabela = migration.indexOf('CREATE TABLE IF NOT EXISTS public.localidades')
  const idxFk = migration.indexOf('ADD COLUMN IF NOT EXISTS localidade_id INTEGER REFERENCES public.localidades(id)')
  assert.ok(idxTabela >= 0, 'cria tabela localidades')
  assert.ok(idxFk >= 0, 'adiciona FK localidade_id em solicitacoes')
  assert.ok(idxTabela < idxFk, 'tabela localidades criada ANTES da FK (ordem correta)')
})

test('migration: ordem segura CREATE TABLE → RLS/REVOKE → FK/índice', () => {
  const idxTable = migration.indexOf('CREATE TABLE IF NOT EXISTS public.localidades')
  const idxRls = migration.indexOf('ALTER TABLE public.localidades ENABLE ROW LEVEL SECURITY')
  const idxRevokeTable = migration.indexOf('REVOKE ALL ON public.localidades FROM anon, authenticated, PUBLIC')
  const idxRevokeSeq = migration.indexOf('REVOKE ALL ON SEQUENCE public.localidades_id_seq FROM anon, authenticated, PUBLIC')
  const idxFk = migration.indexOf('ADD COLUMN IF NOT EXISTS localidade_id INTEGER REFERENCES public.localidades(id)')
  const idxIndex = migration.indexOf('CREATE INDEX IF NOT EXISTS idx_solicitacoes_localidade ON public.solicitacoes (localidade_id)')

  assert.ok(idxTable >= 0, 'CREATE TABLE presente')
  assert.ok(idxRls >= 0, 'RLS ENABLE presente')
  assert.ok(idxRevokeTable >= 0, 'REVOKE tabela presente')
  assert.ok(idxRevokeSeq >= 0, 'REVOKE sequence presente')
  assert.ok(idxFk >= 0, 'FK presente')
  assert.ok(idxIndex >= 0, 'índice presente')

  assert.ok(idxTable < idxRls, 'tabela antes de RLS')
  assert.ok(idxRls < idxRevokeTable, 'RLS antes de REVOKE tabela')
  assert.ok(idxRevokeTable < idxRevokeSeq, 'REVOKE tabela antes de REVOKE sequence')
  assert.ok(idxRevokeSeq < idxFk, 'REVOKE sequence antes da FK')
  assert.ok(idxFk < idxIndex, 'FK antes do índice')
})

test('migration protege tabela localidades com RLS e REVOKE (anon, authenticated, PUBLIC)', () => {
  assert.ok(
    /ALTER TABLE public\.localidades ENABLE ROW LEVEL SECURITY/.test(migration),
    'RLS habilitado na tabela localidades'
  )
  assert.ok(!/FORCE ROW LEVEL SECURITY/i.test(migration), 'não força RLS sobre o dono')
  assert.ok(
    /REVOKE ALL ON public\.localidades FROM anon, authenticated, PUBLIC/.test(migration),
    'revoga privilégios na tabela (inclui PUBLIC)'
  )
  assert.ok(
    /REVOKE ALL ON SEQUENCE public\.localidades_id_seq FROM anon, authenticated, PUBLIC/.test(migration),
    'revoga privilégios na sequence (inclui PUBLIC)'
  )
  assert.ok(!/\bGRANT\s/i.test(codigoMigration), 'nenhum GRANT novo na migration')
})

test('migration não inclui seed de localidade (aguarda confirmação do nome oficial)', () => {
  assert.ok(
    !/INSERT INTO public\.localidades\s*\(nome,\s*tipo\)\s*VALUES\s*\(/.test(codigoMigration),
    'não há INSERT de seed na migration (comentado ou ausente)'
  )
})

test('migration é idempotente e não remove objetos nem dados', () => {
  assert.ok(!/\bDROP\s+(TABLE|INDEX|CONSTRAINT|SCHEMA|VIEW|DATABASE)\b/i.test(codigoMigration))
  assert.ok(!/\bTRUNCATE\b/i.test(codigoMigration))
  assert.ok(!/\bDELETE\s+FROM\b/i.test(codigoMigration))
  assert.ok(!/\bCREATE\s+EXTENSION\b/i.test(codigoMigration))
  assert.ok(!/\bCREATE\s+TABLE\b(?!\s+IF\s+NOT\s+EXISTS)/i.test(codigoMigration))
  assert.ok(/BEGIN;/.test(migration) && /COMMIT;/.test(migration), 'transação única')
  assert.ok(/CREATE TABLE IF NOT EXISTS public\.localidades/.test(migration))
  assert.ok(/ADD COLUMN IF NOT EXISTS localidade_id INTEGER REFERENCES public\.localidades\(id\)/.test(migration))
})

test('ensureDatabaseSchema NÃO cria localidades nem FK automaticamente (apps/api)', () => {
  assert.ok(!schemaTs.includes('CREATE TABLE IF NOT EXISTS localidades'), 'schema.ts não cria tabela localidades')
  assert.ok(!schemaTs.includes('localidade_id INTEGER REFERENCES localidades'), 'schema.ts não adiciona FK localidade_id')
  assert.ok(!schemaTs.includes('idx_localidades_tipo_ativo'), 'schema.ts não cria índice de localidades')
  assert.ok(!schemaTs.includes('idx_solicitacoes_localidade'), 'schema.ts não cria índice FK em solicitacoes')
  assert.ok(!schemaTs.includes('update_localidades_timestamp'), 'schema.ts não cria trigger de localidades')
})

test('ensureDatabaseSchema NÃO cria localidades nem FK automaticamente (deploy/api)', () => {
  assert.ok(!deploySchemaTs.includes('CREATE TABLE IF NOT EXISTS localidades'), 'deploy schema.ts não cria tabela localidades')
  assert.ok(!deploySchemaTs.includes('localidade_id INTEGER REFERENCES localidades'), 'deploy schema.ts não adiciona FK localidade_id')
  assert.ok(!deploySchemaTs.includes('idx_localidades_tipo_ativo'), 'deploy schema.ts não cria índice de localidades')
  assert.ok(!deploySchemaTs.includes('idx_solicitacoes_localidade'), 'deploy schema.ts não cria índice FK em solicitacoes')
  assert.ok(!deploySchemaTs.includes('update_localidades_timestamp'), 'deploy schema.ts não cria trigger de localidades')
})

test('espelho apps/api ↔ deploy/api sincronizado (sem localidades no schema.ts)', () => {
  // Ambos não devem ter os blocos de localidades
  const blocosProibidos = [
    'CREATE TABLE IF NOT EXISTS localidades',
    'idx_localidades_tipo_ativo',
    'idx_localidades_nome',
    'update_localidades_timestamp',
    'localidade_id INTEGER REFERENCES localidades',
    'idx_solicitacoes_localidade',
  ]
  for (const bloco of blocosProibidos) {
    assert.ok(!schemaTs.includes(bloco), `apps/api/schema.ts NÃO contém: ${bloco}`)
    assert.ok(!deploySchemaTs.includes(bloco), `deploy/api/schema.ts NÃO contém: ${bloco}`)
  }
})

test('solicitacoes antigas compatíveis com localidade_id NULL', () => {
  // A migration usa ADD COLUMN IF NOT EXISTS sem NOT NULL
  assert.ok(
    /ADD COLUMN IF NOT EXISTS localidade_id INTEGER REFERENCES public\.localidades\(id\)/.test(migration),
    'FK é nullable (sem NOT NULL)'
  )
  assert.ok(
    !/ADD COLUMN IF NOT EXISTS localidade_id INTEGER REFERENCES public\.localidades\(id\) NOT NULL/.test(migration),
    'FK NÃO tem NOT NULL'
  )
})

test('migration adiciona tipo_localidade em solicitacoes com CHECK de valores permitidos', () => {
  assert.ok(
    /ADD COLUMN IF NOT EXISTS tipo_localidade VARCHAR\(20\) CHECK \(tipo_localidade IN \('sede', 'distrito', 'vila'\)\)/.test(migration),
    'adiciona tipo_localidade com CHECK de valores permitidos'
  )
  assert.ok(
    !/ADD COLUMN IF NOT EXISTS tipo_localidade.*NOT NULL/.test(migration),
    'tipo_localidade NÃO tem NOT NULL (compatível com registros antigos)'
  )
})

test('migration NÃO usa UNNEST(STRING_TO_ARRAY(...)) diretamente no SET (SQL inválido)', () => {
  // UNNEST é set-returning e não pode ser usado diretamente no SET
  // A normalização deve usar REGEXP_REPLACE ou expressão equivalente válida
  assert.ok(
    !/SET nome_normalizado\s*=\s*\(\s*SELECT\s+.*UNNEST\s*\(/.test(codigoMigration),
    'UPDATE não deve usar UNNEST diretamente no SET'
  )
})

test('migration usa normalização canônica compatível com a API (remove diacríticos via unaccent, lowercase, trim, colapsa espaços)', () => {
  // A normalização na migration deve corresponder à API: NFD + remove diacríticos (unaccent) + lowercase + trim + colapsa espaços
  // Verifica uso de unaccent (extensão já disponível), trim, lower, regexp_replace para colapsar espaços
  assert.ok(
    /unaccent\(/.test(codigoMigration) && /TRIM\(/.test(codigoMigration) && /LOWER\(/.test(codigoMigration) && /REGEXP_REPLACE.*\\s\+.*' '/.test(codigoMigration),
    'Migration deve usar unaccent + trim + lower + regexp_replace para colapsar espaços (equivalente a normalizarNomeCanonico da API)'
  )
})

test('migration valida definição da constraint UNIQUE (nome_normalizado, tipo) e falha se incompatível', () => {
  // Verifica que a migration inspeciona a constraint via catálogo PostgreSQL (pg_attribute/pg_index)
  assert.ok(
    /pg_attribute.*pg_index|SELECT COUNT\(\*\).*ARRAY_AGG.*attname/.test(codigoMigration),
    'Migration deve validar definição exata via catálogo PostgreSQL (pg_attribute/pg_index)'
  )
  assert.ok(
    /definição incompatível|incompatível/.test(migration),
    'Migration deve falhar com erro se definição for incompatível'
  )
  assert.ok(
    /conflito de nome|nome ocupado/.test(migration),
    'Migration deve falhar se nome ocupado por objeto incompatível'
  )
})

test('migration valida definição exata de duas colunas (nome_normalizado, tipo) via pg_attribute/pg_index', () => {
  // Verifica que a migration valida exatamente duas colunas na ordem correta via catálogo PostgreSQL
  assert.ok(
    /pg_attribute.*pg_index|SELECT COUNT\(\*\).*ARRAY_AGG.*attname/.test(codigoMigration),
    'Migration deve validar exatamente duas colunas (nome_normalizado, tipo) via catálogo PostgreSQL'
  )
  assert.ok(
    /v_col_count.*2.*v_col_names.*\['nome_normalizado','tipo'\]/.test(codigoMigration) || /ARRAY\['nome_normalizado','tipo'\]/.test(codigoMigration),
    'Migration deve validar exatamente as colunas nome_normalizado e tipo na ordem correta'
  )
})

test('migration comenta que há backfill de nome_normalizado (não diz "Sem UPDATE de dados")', () => {
  // O comentário não deve dizer "Sem UPDATE de dados" pois há backfill
  // Procura por comentário que menciona backfill ou preenchimento
  assert.ok(
    /backfill|preench|preenche|UPDATE.*nome_normalizado|preencher/i.test(migration),
    'Migration deve mencionar backfill/preenchimento de nome_normalizado'
  )
})

test('migration documenta dependência da extensão unaccent', () => {
  // A migration deve documentar que depende da extensão unaccent (já criada em ensureDatabaseSchema)
  assert.ok(
    /DEPENDE|depende|unaccent.*extens|extensão.*unaccent/i.test(migration),
    'Migration deve documentar dependência da extensão unaccent'
  )
})

// --- Novos testes para validar detalhes da constraint UNIQUE ---

test('migration usa conindid da constraint para obter o índice associado (não oid)', () => {
  // A constraint UNIQUE deve usar conindid para obter o índice associado
  assert.ok(
    /conindid/.test(codigoMigration),
    'Migration deve usar conindid da constraint para obter índice associado'
  )
  assert.ok(
    /SELECT c\.oid, c\.conindid/.test(codigoMigration) || /c\.conindid/.test(codigoMigration),
    'Migration deve selecionar conindid da constraint'
  )
})

test('migration valida ordem das chaves do índice via unnest WITH ORDINALITY', () => {
  // A validação deve usar unnest WITH ORDINALITY para obter ordem correta das chaves
  assert.ok(
    /unnest\(i\.indkey\) WITH ORDINALITY/.test(codigoMigration) || /unnest\(i\.indkey\).*WITH ORDINALITY/.test(codigoMigration),
    'Migration deve usar unnest WITH ORDINALITY para ordem das chaves'
  )
  assert.ok(
    /ORDER BY k\.ord/.test(codigoMigration),
    'Migration deve ordenar colunas por ordem do índice (k.ord)'
  )
})

test('migration filtra apenas colunas-chave do índice via indnkeyatts (exclui INCLUDE)', () => {
  // A validação deve usar indnkeyatts para filtrar apenas colunas-chave
  assert.ok(
    /k\.ord <= i\.indnkeyatts/.test(codigoMigration),
    'Migration deve filtrar apenas colunas-chave via indnkeyatts (exclui INCLUDE)'
  )
})

test('migration valida associação constraint→índice via conindid (não oid)', () => {
  // A constraint deve ser associada ao índice via conindid, não pelo oid
  assert.ok(
    /c\.conindid/.test(codigoMigration),
    'Migration deve usar conindid para associar constraint ao índice'
  )
  assert.ok(
    /v_index_oid/.test(codigoMigration),
    'Migration deve capturar o OID do índice via conindid'
  )
})

test('migration valida exatamente duas colunas-chave na ordem (nome_normalizado, tipo)', () => {
  // A validação deve confirmar exatamente 2 colunas na ordem correta
  assert.ok(
    /v_col_count <> 2/.test(codigoMigration) || /v_col_count <> 2/.test(codigoMigration),
    'Migration deve validar exatamente 2 colunas-chave'
  )
  assert.ok(
    /ARRAY\['nome_normalizado','tipo'\]/.test(codigoMigration),
    'Migration deve validar ordem exata: nome_normalizado, tipo'
  )
})

test('migration vincula pg_attribute à tabela indexada via attrelid = indrelid', () => {
  // A consulta de colunas deve restringir pg_attribute à tabela indexada
  assert.ok(
    /a\.attrelid = i\.indrelid/.test(codigoMigration) || /attrelid = i\.indrelid/.test(codigoMigration),
    'Migration deve vincular pg_attribute à tabela indexada (attrelid = indrelid)'
  )
})

test('migration filtra índices válidos via indisvalid na busca de equivalente', () => {
  // A busca de índice equivalente deve filtrar apenas índices válidos
  assert.ok(
    /i\.indisvalid/.test(codigoMigration),
    'Migration deve filtrar apenas índices válidos (indisvalid) na busca de equivalente'
  )
})

test('migration garante idempotência na re-execução: constraint existente com definição correta retorna silenciosamente', () => {
  // Se constraint já existe com definição correta, deve retornar silenciosamente
  assert.ok(
    /RETURN;/.test(codigoMigration),
    'Migration deve ter RETURN para idempotência'
  )
  assert.ok(
    /idempotente/.test(migration),
    'Migration deve ter comentário sobre idempotência'
  )
})

test('migration detecta índice UNIQUE equivalente com outro nome e falha com erro claro', () => {
  // Se já existe índice UNIQUE equivalente com outro nome, deve falhar com erro claro
  assert.ok(
    /índice UNIQUE equivalente.*outro nome|UNIQUE equivalente.*outro nome/.test(codigoMigration) || /índice UNIQUE equivalente/.test(codigoMigration),
    'Migration deve detectar índice UNIQUE equivalente com outro nome'
  )
  assert.ok(
    /RAISE EXCEPTION.*equivalente|EXCEPTION.*equivalente/.test(codigoMigration),
    'Migration deve falhar com erro claro para índice equivalente com outro nome'
  )
})

test('migration valida ausência de colunas INCLUDE via indnkeyatts na busca de equivalente', () => {
  // A busca de índice equivalente deve verificar ausência de colunas INCLUDE
  assert.ok(
    /NOT EXISTS.*indnkeyatts|a\.attnum > i\.indnkeyatts/.test(codigoMigration),
    'Migration deve validar ausência de colunas INCLUDE via indnkeyatts'
  )
})