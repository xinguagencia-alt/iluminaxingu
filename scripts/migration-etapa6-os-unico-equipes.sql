-- ============================================================
-- IluminaXingu - Etapa 6: Distribuicao automatica de OS
-- Data: 2026-11-12
-- STATUS: APLICADA EM PRODUCAO em 2026-11-12 (SQL Editor Supabase)
--        Versao com cast ::text (corrigiu 42883 name[] = text[]).
--
-- Objetivos:
--   1) Eliminar risco de OS duplicada para a mesma solicitacao
--      (UNIQUE em ordens_servico.solicitacao_id)
--   2) Colunas opcionais de equipes para disponibilidade,
--      capacidade e especialidades (compatibilidade com tipos)
--
-- Regras:
--   - Idempotente (pode ser reexecutada)
--   - Sem DROP/DELETE de dados da aplicacao
--   - Nao altera PostGIS, spatial_ref_sys, geometry_columns
--   - Nao altera policies RLS existentes (RLS ja ativo em
--     ordens_servico e equipes; API usa postgres/BYPASSRLS)
--   - Novas colunas herdam RLS da tabela pai
--
-- PREREQUISITO (etapa manual antes do INDEX UNIQUE):
--   1) Duplicidades — se houver, resolver caso a caso ANTES do index
--      (o CREATE UNIQUE INDEX falhara se houver conflito):
--        SELECT solicitacao_id, COUNT(*)
--          FROM ordens_servico
--         GROUP BY solicitacao_id
--        HAVING COUNT(*) > 1;
--   2) Nulos — UNIQUE nao impede multiplas OS com solicitacao_id NULL:
--        SELECT COUNT(*) AS nulos
--          FROM public.ordens_servico
--         WHERE solicitacao_id IS NULL;
--      nulos = 0: aprovado; nulos > 0: PARAR e informar (nao aplicar).
--
-- NOTA UNIQUE (evita indice redundante):
--   Antes de criar idx_ordens_servico_solicitacao_id_unico, esta
--   migration detecta qualquer protecao UNIQUE em
--   ordens_servico.solicitacao_id independentemente do nome:
--     - UNIQUE constraint (contype = 'u') com exatamente essa coluna;
--     - UNIQUE index (indisunique) com exatamente essa coluna
--       (inclusive o que ja backing de constraint).
--   So cria o indice se NENHUMA protecao equivalente existir.
--   Nao remove constraints/indices existentes.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) UNIQUE: uma OS por solicitacao
--    Criar indice apenas se nao houver UNIQUE equivalente
--    (constraint ou index) em solicitacao_id, qualquer que seja
--    o nome. Reexecutavel: na 2a vez ja ha protecao e nao faz nada.
-- ------------------------------------------------------------
DO $$
DECLARE
  protecao_existe BOOLEAN;
BEGIN
  SELECT EXISTS (
    -- UNIQUE constraint com colunas exatamente = [solicitacao_id]
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.ordens_servico'::regclass
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attnum)
        FROM pg_attribute a
        WHERE a.attrelid = c.conrelid
          AND a.attnum = ANY (c.conkey)
      ) = ARRAY['solicitacao_id']
  )
  OR EXISTS (
    -- UNIQUE index de coluna unica solicitacao_id
    -- (indnkeyatts = 1 e indnatts = 1: chave exatamente 1 coluna;
    --  indisvalid: indice valido/visivel para protecao)
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.ordens_servico'::regclass
      AND i.indisunique
      AND i.indisvalid
      AND i.indnkeyatts = 1
      AND i.indnatts = 1
      AND (
        SELECT a.attname::text
        FROM pg_attribute a
        WHERE a.attrelid = i.indrelid
          AND a.attnum = i.indkey[0]
      ) = 'solicitacao_id'
  )
  INTO protecao_existe;

  IF NOT protecao_existe THEN
    CREATE UNIQUE INDEX idx_ordens_servico_solicitacao_id_unico
      ON public.ordens_servico (solicitacao_id);
  END IF;
END$$;

-- ------------------------------------------------------------
-- 2) Equipes: disponibilidade, capacidade e especialidades
--    (colunas opcionais; a API usa defaults seguros se ausentes)
-- ------------------------------------------------------------
ALTER TABLE public.equipes
  ADD COLUMN IF NOT EXISTS status_disponibilidade VARCHAR(30) NOT NULL DEFAULT 'disponivel';

ALTER TABLE public.equipes
  ADD COLUMN IF NOT EXISTS capacidade_maxima INTEGER NOT NULL DEFAULT 3;

-- Lista separada por virgula de valores de tipo_problema.
-- NULL ou vazio = compativel com todos os tipos.
ALTER TABLE public.equipes
  ADD COLUMN IF NOT EXISTS especialidades VARCHAR(500);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'equipes_status_disponibilidade_check'
  ) THEN
    ALTER TABLE public.equipes
      ADD CONSTRAINT equipes_status_disponibilidade_check
      CHECK (status_disponibilidade IN ('disponivel', 'manutencao', 'bloqueada'));
  END IF;
END$$;

COMMIT;

-- ============================================================
-- APOS APLICAR (manual, com autorizacao):
--   A API passa a ler status_disponibilidade, capacidade_maxima
--   e especialidades via information_schema; enquanto as colunas
--   nao existirem, vale:
--     - disponibilidade: todas as equipes ativas
--     - capacidade: 3 OS abertas por equipe (constante segura)
--     - especialidades: compativel com qualquer tipo
-- ============================================================
