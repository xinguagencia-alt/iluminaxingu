-- ============================================================
-- IluminaXingu - Etapa 7: Confirmacoes de moradores
-- Data: 2026-11-13
-- STATUS: PENDENTE (nao executada; aguarda autorizacao)
--
-- Objetivos:
--   1) Tabela public.confirmacoes: cada morador distinto que
--      confirma a MESMA solicitacao ja em atendimento
--   2) Coluna solicitacoes.confirmacoes_elevacao_em: marca quando
--      a prioridade ja foi elevada por confirmacoes (1 unica vez)
--
-- Regras de negocio (Etapa 7):
--   - O primeiro solicitante conta como o morador 1 e NAO gera
--     linha em confirmacoes (telefone original nunca confirma)
--   - 1o confirmador -> total 2 -> SEM elevacao
--   - 2o confirmador -> total 3 -> eleva exatamente 1 nivel
--   - Nunca eleva de novo na mesma solicitacao
--     (guarda confirmacoes_elevacao_em IS NULL)
--   - Elevacao so em solicitacao aberta (status fora de
--     concluida/cancelada/nao_procedente/duplicada)
--
-- Protecao de unicidade (conferida por DEFINICAO, nunca por nome):
--   - Considera equivalente qualquer indice UNIQUE, valido,
--     nao parcial e nao expressao, cujas colunas-chave sejam
--     exatamente (solicitacao_id, telefone_normalizado)
--   - Se ja existir protecao equivalente, nada e criado
--     (nao cria indice unico redundante)
--   - Se o nome desejado estiver ocupado por objeto incompativel,
--     o script FALHA com mensagem clara em vez de pular em silencio
--   - Nada e removido: sem DROP, DELETE, UPDATE ou TRUNCATE
--
-- Seguranca:
--   - Telefone gravado normalizado (somente digitos, coluna
--     VARCHAR(20)); nenhuma PII nova em texto livre
--   - RLS ativo + REVOKE de anon, authenticated e PUBLIC (API usa
--     postgres/BYPASSRLS)
--
-- Idempotente (pode ser reexecutada).
-- Nao altera PostGIS, spatial_ref_sys, geometry_columns,
-- policies existentes nem dados de solicitacoes.
--
-- IMPORTANTE: esta tabela NAO e criada por ensureDatabaseSchema
-- (schema.ts). Enquanto a migration nao for aplicada, a API
-- degrada com aviso em log e responde sem o bloco `confirmacao`.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Tabela de confirmacoes
--    ON DELETE CASCADE acompanha a solicitacao (mesma regra do
--    ciclo de retencao LGPD aplicado a solicitacoes)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.confirmacoes (
  id                   SERIAL PRIMARY KEY,
  solicitacao_id       INTEGER NOT NULL
                             REFERENCES public.solicitacoes (id) ON DELETE CASCADE,
  telefone_normalizado VARCHAR(20) NOT NULL,
  origem               VARCHAR(20) NOT NULL DEFAULT 'portal',
  client_request_id    VARCHAR(64),
  criado_em            TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2) Protecao de unicidade por definicao das colunas
--    1 linha por morador por solicitacao (garante 1 elevacao
--    mesmo com confirmacoes simultaneas). O nome do indice nao
--    decide nada: o que vale e a chave UNIQUE (solicitacao_id,
--    telefone_normalizado) valida, sem predicado e sem expressao.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_alvo        CONSTANT text[] := ARRAY['solicitacao_id', 'telefone_normalizado'];
  v_nome        CONSTANT text := 'idx_confirmacoes_solicitacao_telefone_unico';
  v_idx                  record;
  v_colunas              text[];
  v_equivalente          boolean := false;
  v_colunas_obrigatorias integer;
BEGIN
  SELECT count(*) INTO v_colunas_obrigatorias
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'confirmacoes'
     AND column_name IN ('solicitacao_id', 'telefone_normalizado');

  IF v_colunas_obrigatorias <> 2 THEN
    RAISE EXCEPTION
      'Etapa 7: public.confirmacoes existe sem as colunas solicitacao_id e telefone_normalizado (divergencia de schema). Nada foi alterado; corrija manualmente e reexecute.';
  END IF;

  FOR v_idx IN
    SELECT i.indisunique AS unico,
           i.indisvalid AS valido,
           i.indpred IS NULL AS sem_predicado,
           i.indexprs IS NULL AS sem_expressao,
           i.indnkeyatts AS colunas_chave,
           (SELECT array_agg(a.attname::text ORDER BY a.attname)
              FROM unnest(
                     regexp_split_to_array(btrim(i.indkey::text), '\s+')::smallint[]
                   ) WITH ORDINALITY AS k(attnum, ord)
              JOIN pg_attribute a
                ON a.attrelid = i.indrelid
               AND a.attnum = k.attnum
             WHERE k.ord <= i.indnkeyatts
               AND k.attnum > 0) AS colunas
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'confirmacoes'
  LOOP
    IF v_idx.unico
       AND v_idx.valido
       AND v_idx.sem_predicado
       AND v_idx.sem_expressao
       AND v_idx.colunas_chave = 2
       AND v_idx.colunas IS NOT NULL
       AND v_idx.colunas = v_alvo THEN
      v_equivalente := true;
      EXIT;
    END IF;
  END LOOP;

  IF v_equivalente THEN
    RAISE NOTICE
      'Etapa 7: ja existe indice UNICO equivalente a (solicitacao_id, telefone_normalizado); criacao pulada (sem indice redundante).';
    RETURN;
  END IF;

  IF to_regclass('public.' || v_nome) IS NOT NULL THEN
    RAISE EXCEPTION
      'Etapa 7: o objeto "%" ja existe em public e NAO protege (solicitacao_id, telefone_normalizado). Nada foi alterado; resolva o conflito de nome manualmente antes de reexecutar.',
      v_nome;
  END IF;

  EXECUTE format(
    'CREATE UNIQUE INDEX %I ON public.confirmacoes (solicitacao_id, telefone_normalizado)',
    v_nome
  );
END $$;

-- ------------------------------------------------------------
-- 3) Marcador de elevacao unica por solicitacao
--    (NULL = ainda nao elevou por confirmacoes)
-- ------------------------------------------------------------
ALTER TABLE public.solicitacoes
  ADD COLUMN IF NOT EXISTS confirmacoes_elevacao_em TIMESTAMP;

-- ------------------------------------------------------------
-- 4) RLS + revogacao de privilegios (anon, authenticated e PUBLIC)
--    Nao mexemos em postgres, service_role nem policies existentes
-- ------------------------------------------------------------
ALTER TABLE public.confirmacoes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.confirmacoes FROM anon, authenticated, PUBLIC;
REVOKE ALL ON SEQUENCE public.confirmacoes_id_seq FROM anon, authenticated, PUBLIC;

COMMIT;

-- ============================================================
-- APOS APLICAR (manual, com autorizacao):
--   1) Nao ha passo de dados: confirmacoes nasce vazia e as
--      solicitacoes abertas continuam com a prioridade atual
--      (a 1a elevacao ocorre quando o total alcancar 3)
--   2) Verificar:
--        SELECT column_name FROM information_schema.columns
--         WHERE table_name = 'solicitacoes'
--           AND column_name = 'confirmacoes_elevacao_em';
--        SELECT to_regclass('public.confirmacoes') AS tabela;
--   3) Reiniciar a funcao da API para reconhecer a migration
-- ============================================================
