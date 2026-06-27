-- Tabela de avenidas e ruas oficiais de Sao Felix do Xingu
CREATE TABLE IF NOT EXISTS ruas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('avenida', 'rua')),
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT NOW(),
  UNIQUE (nome, tipo)
);

CREATE INDEX IF NOT EXISTS idx_ruas_nome ON ruas (nome);
CREATE INDEX IF NOT EXISTS idx_ruas_tipo ON ruas (tipo);
CREATE INDEX IF NOT EXISTS idx_ruas_ativo ON ruas (ativo);

-- Avenidas oficiais
INSERT INTO ruas (nome, tipo) VALUES
  ('Avenida 22 de Março', 'avenida'),
  ('Avenida Antonio Marques Ribeiro', 'avenida'),
  ('Avenida Araguaia', 'avenida'),
  ('Avenida Ceará', 'avenida'),
  ('Avenida Cerejeira', 'avenida'),
  ('Avenida Coronel Tancredo Neves', 'avenida'),
  ('Avenida das Nações', 'avenida'),
  ('Avenida Gardênia', 'avenida'),
  ('Avenida Goiás', 'avenida'),
  ('Avenida JK', 'avenida'),
  ('Avenida Maranhão', 'avenida'),
  ('Avenida Piauí', 'avenida'),
  ('Avenida Rio Xingu', 'avenida'),
  ('Avenida Serra', 'avenida')
ON CONFLICT (nome, tipo) DO NOTHING;

-- Ruas oficiais
INSERT INTO ruas (nome, tipo) VALUES
  ('Rua 7 de Setembro', 'rua'),
  ('Rua Antúrio', 'rua'),
  ('Rua Chuva de Prata', 'rua'),
  ('Rua Constantino Ferreira Viana', 'rua'),
  ('Rua Copo de Leite', 'rua'),
  ('Rua Crisântemo', 'rua'),
  ('Rua Esporinha', 'rua'),
  ('Rua Flor de Cenoura', 'rua'),
  ('Rua Gravina', 'rua'),
  ('Rua Íris', 'rua'),
  ('Rua Leônidas', 'rua'),
  ('Rua Neusin Celestino dos Santos', 'rua'),
  ('Rua Osterno Maia', 'rua')
ON CONFLICT (nome, tipo) DO NOTHING;
