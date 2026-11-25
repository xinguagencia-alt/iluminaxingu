-- Migration: Tabela localidades e FK em solicitacoes
-- IluminaXingu - São Félix do Xingu
-- Executar no banco Supabase/PostgreSQL
-- Idempotente (pode ser reexecutada)
-- COM backfill de nome_normalizado (UPDATE de dados)
-- Sem alterar PostGIS, spatial_ref_sys, geometry_columns, geography_columns
-- Sem criar policies (API usa postgres/BYPASSRLS)
-- DEPENDE: extensão unaccent (já criada em ensureDatabaseSchema via CREATE EXTENSION IF NOT EXISTS unaccent)

BEGIN;

-- ------------------------------------------------------------
-- 1) Tabela localidades - criação base (sem nome_normalizado para compatibilidade)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.localidades (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('sede', 'distrito', 'vila')),
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 1b) Coluna nome_normalizado - adicionar se não existe, preencher, validar, depois tornar NOT NULL + UNIQUE
-- Normalização canônica (equivalente a normalizarNomeCanonico() da API):
-- trim → NFD → remover diacríticos (unaccent) → lowercase → colapsar espaços internos
-- ------------------------------------------------------------
ALTER TABLE public.localidades
  ADD COLUMN IF NOT EXISTS nome_normalizado VARCHAR(120);

-- Preencher nome_normalizado onde for NULL usando a normalização canônica:
-- unaccent remove diacríticos (requer extensão unaccent, já criada em ensureDatabaseSchema)
-- REGEXP_REPLACE colapsa espaços internos para um único espaço
WITH normalized AS (
  SELECT
    id,
    LOWER(REGEXP_REPLACE(unaccent(TRIM(nome)), '\s+', ' ', 'g')) AS nome_norm
  FROM public.localidades
  WHERE nome_normalizado IS NULL
)
UPDATE public.localidades l
SET nome_normalizado = n.nome_norm
FROM normalized n
WHERE l.id = n.id;

-- Verificar colisões ANTES de impor NOT NULL + UNIQUE
DO $$
DECLARE
  conflitos INTEGER;
BEGIN
  SELECT COUNT(*) INTO conflitos
  FROM (
    SELECT nome_normalizado, tipo, COUNT(*) as cnt
    FROM public.localidades
    WHERE nome_normalizado IS NOT NULL
    GROUP BY nome_normalizado, tipo
    HAVING COUNT(*) > 1
  ) t;

  IF conflitos > 0 THEN
    RAISE EXCEPTION 'Conflitos de duplicidade detectados em (nome_normalizado, tipo). Resolva manualmente antes de reexecutar a migration.';
  END IF;
END$$;

-- Tornar NOT NULL (só depois de preencher e validar)
ALTER TABLE public.localidades
  ALTER COLUMN nome_normalizado SET NOT NULL;

-- Constraint UNIQUE específica em public.localidades
-- Valida também a definição: se o nome estiver ocupado por definição incompatível, lança erro claro
DO $$
DECLARE
  v_constraint_oid OID;
  v_index_oid OID;
  v_col_count INTEGER;
  v_col_names text[];
BEGIN
  -- Busca a constraint UNIQUE pelo nome
  SELECT c.oid, c.conindid INTO v_constraint_oid, v_index_oid
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE n.nspname = 'public'
    AND c.conname = 'uq_localidades_nome_normalizado_tipo'
    AND c.contype = 'u'
    AND c.conrelid = 'public.localidades'::regclass;

  IF v_constraint_oid IS NOT NULL THEN
    -- Constraint existe. Valida que o índice associado tem exatamente as duas colunas-chave
    -- na ordem correta (nome_normalizado, tipo), ignorando colunas INCLUDE.
    SELECT COUNT(*), ARRAY_AGG(a.attname::text ORDER BY k.ord)
    INTO v_col_count, v_col_names
    FROM pg_attribute a
    JOIN pg_index i ON i.indrelid = a.attrelid
    JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON a.attnum = k.attnum
    WHERE i.indexrelid = v_index_oid
      AND k.ord <= i.indnkeyatts;  -- apenas colunas-chave, exclui INCLUDE

    IF v_col_count <> 2 OR v_col_names <> ARRAY['nome_normalizado','tipo'] THEN
      RAISE EXCEPTION 'Constraint uq_localidades_nome_normalizado_tipo existe em public.localidades mas tem definição incompatível (colunas: %). Esperado: (nome_normalizado, tipo). Resolva manualmente antes de reexecutar.', v_col_names;
    END IF;
    -- Constraint já existe com definição correta - idempotente
    RETURN;
  END IF;

  -- Constraint não existe com esse nome. Verifica se já existe um índice UNIQUE equivalente
  -- com outro nome nas mesmas colunas (nome_normalizado, tipo) nessa ordem.
  IF EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = ic.relnamespace
    WHERE n.nspname = 'public'
      AND i.indrelid = 'public.localidades'::regclass
      AND i.indisunique
      AND i.indisvalid
      AND i.indnkeyatts = 2
      AND i.indpred IS NULL  -- sem predicado parcial
      AND NOT EXISTS (  -- sem colunas INCLUDE
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = i.indexrelid
          AND a.attnum = ANY(i.indkey)
          AND a.attnum > i.indnkeyatts
      )
      AND (
        SELECT ARRAY_AGG(a.attname::text ORDER BY k.ord)
        FROM pg_attribute a
        JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON a.attnum = k.attnum
        WHERE a.attrelid = i.indrelid  -- restringe à tabela indexada
          AND k.ord <= i.indnkeyatts
      ) = ARRAY['nome_normalizado','tipo']::text[]
  ) THEN
    RAISE EXCEPTION 'Já existe índice UNIQUE equivalente em public.localidades nas colunas (nome_normalizado, tipo) com outro nome. Não será criada constraint redundante. Resolva o conflito manualmente antes de reexecutar.';
  END IF;

  -- Nome ocupado por outro objeto (constraint de outro tipo, tabela, view, etc.)
  IF to_regclass('public.uq_localidades_nome_normalizado_tipo') IS NOT NULL THEN
    RAISE EXCEPTION 'Objeto uq_localidades_nome_normalizado_tipo já existe em public e NÃO é a constraint UNIQUE esperada. Resolva o conflito de nome manualmente antes de reexecutar.';
  END IF;

  -- Cria a constraint UNIQUE
  ALTER TABLE public.localidades
    ADD CONSTRAINT uq_localidades_nome_normalizado_tipo
    UNIQUE (nome_normalizado, tipo);
END$$;

CREATE INDEX IF NOT EXISTS idx_localidades_tipo_ativo ON public.localidades (tipo, ativo);
CREATE INDEX IF NOT EXISTS idx_localidades_nome ON public.localidades (nome);

-- Trigger para atualizado_em (reutiliza função update_timestamp existente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_localidades_timestamp'
  ) THEN
    CREATE TRIGGER update_localidades_timestamp
      BEFORE UPDATE ON public.localidades
      FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;
END$$;

-- ------------------------------------------------------------
-- 2) RLS + revogação de privilégios (anon, authenticated e PUBLIC)
--     Não mexemos em postgres, service_role nem policies existentes
-- ------------------------------------------------------------
ALTER TABLE public.localidades ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.localidades FROM anon, authenticated, PUBLIC;
REVOKE ALL ON SEQUENCE public.localidades_id_seq FROM anon, authenticated, PUBLIC;

-- ------------------------------------------------------------
-- 3) Coluna FK nullable em solicitacoes (preserva registros antigos)
-- ------------------------------------------------------------
ALTER TABLE public.solicitacoes
  ADD COLUMN IF NOT EXISTS localidade_id INTEGER REFERENCES public.localidades(id);

ALTER TABLE public.solicitacoes
  ADD COLUMN IF NOT EXISTS tipo_localidade VARCHAR(20) CHECK (tipo_localidade IN ('sede', 'distrito', 'vila'));

CREATE INDEX IF NOT EXISTS idx_solicitacoes_localidade ON public.solicitacoes (localidade_id);

COMMIT;

-- Forçar revalidação de plans (evita cache de plano antigo com RLS off).
-- DISCARD PLANS não pode rodar dentro de transação, por isso fora do BEGIN/COMMIT.
DISCARD PLANS;

-- ------------------------------------------------------------
-- Seed inicial: apenas Sede (nome oficial a confirmar pelo proprietário)
-- ------------------------------------------------------------
-- INSERT INTO public.localidades (nome, nome_normalizado, tipo) VALUES
--   ('São Félix do Xingu', 'sao felix do xingu', 'sede')
-- ON CONFLICT (nome_normalizado, tipo) DO NOTHING;
-- Comentado: aguardar confirmação do nome oficial antes de executar

-- Rollback (não executar sem confirmação):
-- ALTER TABLE public.solicitacoes DROP COLUMN IF EXISTS localidade_id;
-- DROP TABLE IF EXISTS public.localidades;
