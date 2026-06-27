-- Tabela de bairros oficiais de Sao Felix do Xingu
CREATE TABLE IF NOT EXISTS bairros (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(120) UNIQUE NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bairros_nome ON bairros (nome);
CREATE INDEX IF NOT EXISTS idx_bairros_ativo ON bairros (ativo);

-- Inserir bairros oficiais (ignorar se ja existem)
INSERT INTO bairros (nome) VALUES
  ('Aeroporto'),
  ('Atalaia'),
  ('Bela Vista'),
  ('Centro'),
  ('Jardim Novo Planalto'),
  ('Liberdade'),
  ('Minerador'),
  ('Montenegro'),
  ('Primavera'),
  ('Rodoviario'),
  ('Sao Jose'),
  ('Triangulo'),
  ('Vale da Serra (Cai N''Agua)')
ON CONFLICT (nome) DO NOTHING;
