-- ============================================================
-- IluminaXingu - Etapa 7: PRE-CHECK de seguranca (somente leitura)
-- Companion de: scripts/migration-etapa7-confirmacoes.sql
-- STATUS: consulta manual no Supabase SQL Editor (nao executada)
--
-- Regras:
--   - Somente SELECT. Nenhum DDL, DML ou transacao.
--   - Nao listar dados pessoais: apenas contagens e catalogo.
--   - Cada bloco indica: FINALIDADE / APROVA / BLOQUEIA.
--
-- Ordem sugerida: Q0 -> Q1 -> Q2 -> Q3 -> Q3b -> Q4 -> Q5 ->
--                 Q6a -> Q6b -> Q7 -> Q8 -> Q8b -> Q9
-- ============================================================

-- ------------------------------------------------------------
-- Q0 - papel da sessao
-- FINALIDADE: contexto para interpretar grants/RLS e confirmar
--             que o Editor esta num papel que pode aplicar a
--             migration (REVOKE/ENABLE RLS exigem ownership).
-- APROVA    : superusuario = true (padrao Supabase: postgres).
-- BLOQUEIA  : papel anon, authenticated ou service_role.
-- INTERPRET: valores sao legenda; nao mudam a migration.
-- ------------------------------------------------------------
SELECT current_user AS papel,
       r.rolsuper AS superusuario,
       r.rolbypassrls AS bypass_rls
  FROM pg_roles r
 WHERE r.rolname = current_user;

-- ------------------------------------------------------------
-- Q1 - tabela e sequencia existem?
-- FINALIDADE: item 1 do checklist; detecta sequencia orfa
--             homonima (derrubaria o REVOKE da sequence).
-- APROVA    : tabela = null, sequencia = null, tipo_relacao = null.
-- BLOQUEIA  : sequencia preenchida com tabela = null;
--             tipo_relacao <> 'r' (view/foreign table homonima).
-- INTERPRET: tabela preenchida com tipo_relacao = 'r' -> ja
--            existe; nao e erro, mas exige Q2/Q3/Q4/Q6/Q7/Q8.
-- ------------------------------------------------------------
SELECT to_regclass('public.confirmacoes') AS tabela,
       to_regclass('public.confirmacoes_id_seq') AS sequencia,
       (SELECT c.relkind::text
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname = 'confirmacoes') AS tipo_relacao;

-- ------------------------------------------------------------
-- Q2 - estrutura da tabela (executar so se Q1 tabela <> null)
-- FINALIDADE: itens 2 e 4; a migration nao corrige estrutura
--             (CREATE TABLE IF NOT EXISTS apenas pula).
-- APROVA    : 6 colunas - id integer, solicitacao_id integer
--             NOT NULL, telefone_normalizado varchar(20) NOT NULL,
--             origem varchar(20), client_request_id varchar(64),
--             criado_em timestamp NOT NULL.
-- BLOQUEIA  : coluna faltando, tipo divergente ou
--             telefone_normalizado sem NOT NULL.
-- INTERPRET: 0 linhas -> tabela nao existe (volte a Q1).
-- ------------------------------------------------------------
SELECT a.attname AS coluna,
       pg_catalog.format_type(a.atttypid, a.atttypmod) AS tipo,
       a.attnotnull AS obrigatoria,
       pg_get_expr(ad.adbin, ad.adrelid) AS padrao
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
 WHERE n.nspname = 'public'
   AND c.relname = 'confirmacoes'
   AND a.attnum > 0
   AND NOT a.attisdropped
 ORDER BY a.attnum;

-- ------------------------------------------------------------
-- Q3 - indices equivalentes POR COLUNAS (independente do nome)
-- FINALIDADE: item 2/4 - detectar protecao unica ja existente
--             sobre (solicitacao_id, telefone_normalizado),
--             conferindo: unico, valido, sem predicado parcial,
--             sem expressao e colunas-chave exatamente as duas.
-- APROVA    : tabela nova -> 0 linhas; ou pelo menos 1 linha com
--             protecao_equivalente = true.
-- BLOQUEIA  : nenhum equivalente e conflito_de_nome = true
--             (objeto com o nome desejado e incompativel: a
--             migration falha de proposito em vez de pular).
-- INTERPRET: colunas mostradas em ordem alfabetica; indice com
--            INCLUDE e considerado pela chave (indnkeyatts).
-- ------------------------------------------------------------
WITH indice AS (
  SELECT i.indexrelid,
         ic.relname AS indice,
         i.indisunique AS unico,
         i.indisvalid AS valido,
         i.indpred IS NOT NULL AS parcial,
         i.indexprs IS NOT NULL AS expressao,
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
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'public'
     AND t.relname = 'confirmacoes'
)
SELECT indice,
       unico,
       valido,
       parcial AS predicado_parcial,
       expressao AS tem_expressao,
       colunas_chave,
       colunas,
       (unico
        AND valido
        AND NOT parcial
        AND NOT expressao
        AND colunas_chave = 2
        AND colunas = ARRAY['solicitacao_id', 'telefone_normalizado']) AS protecao_equivalente,
       (indice = 'idx_confirmacoes_solicitacao_telefone_unico'
        AND NOT (unico
                 AND valido
                 AND NOT parcial
                 AND NOT expressao
                 AND colunas_chave = 2
                 AND colunas = ARRAY['solicitacao_id', 'telefone_normalizado'])) AS conflito_de_nome
  FROM indice
 ORDER BY indice;

-- ------------------------------------------------------------
-- Q3b - nome desejado ocupado em public (nomes de indice sao
--       compartilhados por todo o schema)
-- FINALIDADE: pre-ver o caminho de falha clara da migration.
-- APROVA    : objeto_com_o_nome = null.
-- BLOQUEIA  : objeto_com_o_nome preenchido e (Q3 sem
--             protecao_equivalente) -> conflito de nome.
-- INTERPRET: se preenchido, confira se ele proprio e a
--            protecao equivalente de Q3 (ai esta aprovado).
-- ------------------------------------------------------------
SELECT to_regclass('public.idx_confirmacoes_solicitacao_telefone_unico') AS objeto_com_o_nome,
       (SELECT c.relkind::text
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname = 'idx_confirmacoes_solicitacao_telefone_unico') AS tipo_do_objeto;

-- ------------------------------------------------------------
-- Q4 - constraints / FK (item 4)
-- FINALIDADE: FK para solicitacoes e PK de solicitacoes.id.
-- APROVA    : confirmacoes sem linhas (tabela nova) OU FK
--             FOREIGN KEY (solicitacao_id) REFERENCES
--             solicitacoes(id) ON DELETE CASCADE; PK em id.
-- BLOQUEIA  : tabela existente sem FK, ou FK com politica
--             diferente de ON DELETE CASCADE; sem PK em id.
-- INTERPRET: linhas de solicitacoes sao so contexto.
-- ------------------------------------------------------------
SELECT conrelid::regclass::text AS tabela,
       conname AS nome,
       pg_get_constraintdef(oid) AS definicao
  FROM pg_constraint
 WHERE connamespace = 'public'::regnamespace
   AND conrelid::regclass::text IN ('public.confirmacoes', 'public.solicitacoes')
 ORDER BY 1, 2;

-- ------------------------------------------------------------
-- Q5 - coluna confirmacoes_elevacao_em (item 3)
-- FINALIDADE: existencia e tipo da coluna.
-- APROVA    : 0 linhas OU 1 linha com timestamp (with/without
--             time zone) e is_nullable = 'YES'.
-- BLOQUEIA  : tipo text/boolean/integer/date; ou is_nullable
--             = 'NO' sem default (quebraria INSERTs novos).
-- INTERPRET: 1 linha com tipo esperado -> migration idempotente.
-- ------------------------------------------------------------
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'solicitacoes'
   AND column_name = 'confirmacoes_elevacao_em';

-- ------------------------------------------------------------
-- Q6a - dados na tabela (executar so se Q1 tabela <> null)
-- FINALIDADE: item 4 - dados que impediriam indice unico e FK.
-- APROVA    : linhas = 0, orfas_sem_solicitacao = 0,
--             duplicatas_da_chave = 0.
-- BLOQUEIA  : duplicatas_da_chave > 0 (CREATE UNIQUE INDEX
--             falha e a transacao inteira aborta);
--             orfas > 0 -> resolver antes.
-- INTERPRET: tudo roda em BEGIN/COMMIT; falha = rollback total.
-- ------------------------------------------------------------
SELECT count(*) AS linhas,
       count(*) FILTER (
         WHERE NOT EXISTS (
           SELECT 1 FROM public.solicitacoes s
            WHERE s.id = c.solicitacao_id)) AS orfas_sem_solicitacao,
       (SELECT count(*) FROM (
          SELECT solicitacao_id, telefone_normalizado
            FROM public.confirmacoes
           GROUP BY 1, 2
          HAVING count(*) > 1) d) AS duplicatas_da_chave
  FROM public.confirmacoes c;

-- ------------------------------------------------------------
-- Q6b - dados na coluna (executar so se Q5 retornou 1 linha)
-- FINALIDADE: ver elevacoes ja marcadas (teste/manual anterior).
-- APROVA    : qualquer numero; ja_marcadas = 0 e o caso esperado.
-- BLOQUEIA  : ja_marcadas > 0 sem origem conhecida (a regra
--             "eleva uma unica vez" estaria pre-marcada).
-- INTERPRET: so informativo; a migration nao altera dados.
-- ------------------------------------------------------------
SELECT count(*) AS total_solicitacoes,
       count(*) FILTER (WHERE confirmacoes_elevacao_em IS NOT NULL) AS ja_marcadas
  FROM public.solicitacoes;

-- ------------------------------------------------------------
-- Q7 - RLS (itens 5 e 7)
-- FINALIDADE: RLS em solicitacoes (requisito de aprovacao) e em
--             confirmacoes (caso ja exista).
-- APROVA    : solicitacoes.rls_ativo = true;
--             confirmacoes ausente OU (rls_ativo = true E
--             rls_forcado = false).
--             confirmacoes com rls_ativo = false NAO bloqueia:
--             a migration executa ENABLE ROW LEVEL SECURITY.
-- BLOQUEIA  : confirmacoes com rls_forcado = true (a API, como
--             dono, passaria a nao ler a propria tabela e toda
--             confirmacao cairia em confirmacao: null);
--             solicitacoes sem RLS ativo.
-- INTERPRET: dono costuma ser postgres; rls_forcado mantem o
--            dono sujeito as policies.
-- ------------------------------------------------------------
SELECT c.relname AS tabela,
       c.relrowsecurity AS rls_ativo,
       c.relforcerowsecurity AS rls_forcado,
       r.rolname AS dono
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_roles r ON r.oid = c.relowner
 WHERE n.nspname = 'public'
   AND c.relname IN ('solicitacoes', 'confirmacoes')
 ORDER BY 1;

-- ------------------------------------------------------------
-- Q8 - grants de anon, authenticated e PUBLIC (itens 6 e 7)
-- FINALIDADE: expor privilegios publicos antes da migration.
-- APROVA    : solicitacoes sem INSERT/UPDATE/DELETE/TRUNCATE
--             para anon, authenticated ou PUBLIC;
--             confirmacoes sem privilegio para anon,
--             authenticated ou PUBLIC - ou, se houver, o
--             REVOKE da propria migration corrige tudo na mesma
--             transacao (REVOKE ALL ... FROM anon, authenticated,
--             PUBLIC), portanto o estado atual nao e bloqueio.
-- BLOQUEIA  : qualquer privilegio de ESCRITA de anon,
--             authenticated ou PUBLIC em solicitacoes (a
--             migration nao mexe nela); privilegio em
--             confirmacoes que NAO seja coberto pelo REVOKE.
-- INTERPRET: service_role/postgres com ALL e o padrao do
--            Supabase e nao bloqueia.
-- ------------------------------------------------------------
SELECT d.table_name AS tabela,
       d.grantee,
       d.privilege_type,
       d.is_grantable
  FROM information_schema.role_table_grants d
 WHERE d.table_schema = 'public'
   AND d.table_name IN ('solicitacoes', 'confirmacoes')
   AND d.grantee IN ('anon', 'authenticated', 'PUBLIC', 'service_role', 'postgres')
 ORDER BY 1, 2, 3;

-- ------------------------------------------------------------
-- Q8b - default privileges em public
-- FINALIDADE: prever se CREATE TABLE confirmacoes nasce ja com
--             grants para anon/authenticated/PUBLIC.
-- APROVA    : 0 linhas, ou ACL sem anon/authenticated/PUBLIC;
--             mesmo com ACL, o REVOKE posterior do script cobre
--             (CREATE -> REVOKE na mesma transacao).
-- BLOQUEIA  : nada por si so; registrar a ocorrencia.
-- INTERPRET: ACL que mencione anon/authenticated/PUBLIC.
-- ------------------------------------------------------------
SELECT r.rolname AS dono_do_acl,
       n.nspname AS schema,
       CASE d.defaclobjtype WHEN 'r' THEN 'tabela' WHEN 'S' THEN 'sequencia' END AS tipo,
       pg_catalog.array_to_string(d.defaclacl, ', ') AS concedido_a
  FROM pg_default_acl d
  JOIN pg_roles r ON r.oid = d.defaclrole
  JOIN pg_namespace n ON n.oid = d.defaclnamespace
 WHERE n.nspname = 'public';

-- ------------------------------------------------------------
-- Q9 - solicitacoes abertas elegiveis (item 8)
-- FINALIDADE: so contagem, sem dado pessoal; base onde a
--             elevacao pode acontecer.
-- APROVA    : qualquer numero, inclusive 0.
-- BLOQUEIA  : nada.
-- INTERPRET: status = STATUS_FECHADOS_DUPLICIDADE; NULL conta
--            como aberto (mesma regra de confirmacoes.ts).
-- ------------------------------------------------------------
SELECT count(*) AS abertas_elegiveis
  FROM public.solicitacoes
 WHERE status_atual IS NULL
    OR status_atual NOT IN ('concluida', 'cancelada', 'nao_procedente', 'duplicada');
