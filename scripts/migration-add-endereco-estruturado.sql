-- Migration: Adicionar endereco estruturado na tabela postes
-- Executar no banco Supabase/Postgres

-- Adicionar colunas estruturadas
ALTER TABLE postes ADD COLUMN IF NOT EXISTS rua VARCHAR(200);
ALTER TABLE postes ADD COLUMN IF NOT EXISTS numero VARCHAR(20);
ALTER TABLE postes ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);
ALTER TABLE postes ADD COLUMN IF NOT EXISTS complemento VARCHAR(200);

-- Migrar dados existentes do campo endereco para os novos campos (se houver dados)
-- Esta parte e opcional - so execute se ja tiver dados no campo endereco
-- UPDATE postes SET
--   rua = SPLIT_PART(endereco, ',', 1),
--   numero = TRIM(SPLIT_PART(endereco, ',', 2)),
--   bairro = TRIM(SPLIT_PART(SPLIT_PART(endereco, ',', 3), '-', 1))
-- WHERE endereco IS NOT NULL AND endereco != '' AND rua IS NULL;

-- Criar indice por bairro para relatorios
CREATE INDEX IF NOT EXISTS idx_postes_bairro ON postes (bairro);
