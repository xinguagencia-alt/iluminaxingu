-- ============================================================
-- IluminaXingu - Etapa A (seguranca) + B1 (indices de FK)
-- Data: 2026-10-23
-- Autorizado pelo usuario em 2026-10-23
--
-- Objetivos:
--   1. Corrigir public.update_timestamp (search_path fixo)
--   2. Ativar RLS nas 14 tabelas da aplicacao
--   3. Revogar ALL de anon/authenticated em tabelas e sequencias
--   4. Criar indices de chaves estrangeiras ausentes
--
-- Regras desta migracao:
--   - Idempotente (pode ser reexecutada)
--   - Sem DROP/DELETE/UPDATE de dados
--   - Sem alterar spatial_ref_sys, geometry_columns, geography_columns
--   - Sem criar policies (API usa postgres/BYPASSRLS)
--   - Sem bloquear a API (CREATE INDEX CONCURRENTLY nao usamos aqui
--     porque supabase SQL Editor nao permite fora de transacao;
--     tabelas sao pequenas e CREATE INDEX rapido)
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Corrigir funcao update_timestamp (sem SECURITY DEFINER)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 2) Ativar RLS nas 14 tabelas da aplicacao
--    (RLS ativo + nenhuma policy = acesso REST negado para
--     anon/authenticated; postgres tem BYPASSRLS e continua OK)
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.admin_users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.solicitacoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.status_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ordens_servico         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.equipes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.anexos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.auditoria              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bairros                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ruas                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.configuracao_estoque   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.itens_estoque          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.movimentacoes_estoque  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.itens_usados_os        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.postes                 ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 4) Revogar privilegios de anon/authenticated
--    Nao mexemos em postgres, service_role
--    nem em espacial_ref_sys/geometry_columns/geography_columns
-- ------------------------------------------------------------
REVOKE ALL ON public.admin_users            FROM anon, authenticated;
REVOKE ALL ON public.solicitacoes           FROM anon, authenticated;
REVOKE ALL ON public.status_logs            FROM anon, authenticated;
REVOKE ALL ON public.ordens_servico         FROM anon, authenticated;
REVOKE ALL ON public.equipes                FROM anon, authenticated;
REVOKE ALL ON public.anexos                 FROM anon, authenticated;
REVOKE ALL ON public.auditoria              FROM anon, authenticated;
REVOKE ALL ON public.bairros                FROM anon, authenticated;
REVOKE ALL ON public.ruas                   FROM anon, authenticated;
REVOKE ALL ON public.configuracao_estoque   FROM anon, authenticated;
REVOKE ALL ON public.itens_estoque          FROM anon, authenticated;
REVOKE ALL ON public.movimentacoes_estoque  FROM anon, authenticated;
REVOKE ALL ON public.itens_usados_os        FROM anon, authenticated;
REVOKE ALL ON public.postes                 FROM anon, authenticated;

-- Sequencias APENAS das 14 tabelas da aplicacao (nao usa ALL SEQUENCES
-- para nao tocar sequencias de outras tabelas do schema public)
DO $$
DECLARE seq_name TEXT;
BEGIN
  FOR seq_name IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'S'
      AND c.relname IN (
        'admin_users_id_seq',
        'solicitacoes_id_seq',
        'status_logs_id_seq',
        'ordens_servico_id_seq',
        'equipes_id_seq',
        'anexos_id_seq',
        'auditoria_id_seq',
        'bairros_id_seq',
        'ruas_id_seq',
        'configuracao_estoque_id_seq',
        'itens_estoque_id_seq',
        'movimentacoes_estoque_id_seq',
        'itens_usados_os_id_seq',
        'postes_id_seq'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', seq_name);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 5) Indices de chaves estrangeiras ausentes (Etapa B1)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_solicitacoes_poste_id
  ON public.solicitacoes (poste_id);

CREATE INDEX IF NOT EXISTS idx_ordens_servico_equipe_id
  ON public.ordens_servico (equipe_id);

CREATE INDEX IF NOT EXISTS idx_anexos_ordem_servico_id
  ON public.anexos (ordem_servico_id);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_estoque_item_id
  ON public.movimentacoes_estoque (item_id);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_estoque_os_id
  ON public.movimentacoes_estoque (os_id);

CREATE INDEX IF NOT EXISTS idx_itens_usados_os_item_id
  ON public.itens_usados_os (item_id);

COMMIT;

-- Forcar revalidacao de plans (evita cache de plano antigo com RLS off).
-- DISCARD PLANS nao pode rodar dentro de transacao, por isso fora do BEGIN/COMMIT.
DISCARD PLANS;

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
