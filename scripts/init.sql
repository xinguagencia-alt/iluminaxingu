-- IluminaXingu - Schema inicial
-- PostgreSQL + PostGIS

CREATE EXTENSION IF NOT EXISTS postgis;

-- Tabela de postes
CREATE TABLE IF NOT EXISTS postes (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(50) UNIQUE NOT NULL,
  endereco TEXT,
  geom GEOMETRY(POINT, 4326),
  tipo_luminaria VARCHAR(100),
  potencia INTEGER,
  data_instalacao DATE,
  data_ultima_manutencao DATE,
  status_ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_postes_geom ON postes USING GIST (geom);
CREATE INDEX idx_postes_codigo ON postes (codigo);

-- Tabela de solicitacoes
CREATE TABLE IF NOT EXISTS solicitacoes (
  id SERIAL PRIMARY KEY,
  protocolo VARCHAR(20) UNIQUE NOT NULL,
  nome_solicitante VARCHAR(200) NOT NULL,
  telefone VARCHAR(20),
  email VARCHAR(200),
  poste_id INTEGER REFERENCES postes(id),
  codigo_poste_informado VARCHAR(50),
  endereco_informado TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  geom GEOMETRY(POINT, 4326),
  tipo_problema VARCHAR(50) NOT NULL,
  descricao TEXT,
  status_atual VARCHAR(30) DEFAULT 'enviada',
  prioridade VARCHAR(10) DEFAULT 'media',
  origem_canal VARCHAR(30) DEFAULT 'web',
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_solicitacoes_protocolo ON solicitacoes (protocolo);
CREATE INDEX idx_solicitacoes_status ON solicitacoes (status_atual);
CREATE INDEX idx_solicitacoes_geom ON solicitacoes USING GIST (geom);

-- Tabela de logs de status
CREATE TABLE IF NOT EXISTS status_logs (
  id SERIAL PRIMARY KEY,
  solicitacao_id INTEGER NOT NULL REFERENCES solicitacoes(id),
  status_anterior VARCHAR(30),
  status_novo VARCHAR(30) NOT NULL,
  observacao TEXT,
  criado_por VARCHAR(100),
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_status_logs_solicitacao ON status_logs (solicitacao_id);

-- Tabela de ordens de servico
CREATE TABLE IF NOT EXISTS ordens_servico (
  id SERIAL PRIMARY KEY,
  solicitacao_id INTEGER NOT NULL REFERENCES solicitacoes(id),
  equipe_id INTEGER,
  status VARCHAR(30) DEFAULT 'aberta',
  data_abertura TIMESTAMP DEFAULT NOW(),
  data_execucao TIMESTAMP,
  data_encerramento TIMESTAMP,
  observacao_execucao TEXT,
  resultado VARCHAR(50),
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ordens_servico_solicitacao ON ordens_servico (solicitacao_id);
CREATE INDEX idx_ordens_servico_status ON ordens_servico (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ordens_servico_solicitacao_unica ON ordens_servico (solicitacao_id);

-- Tabela de anexos
CREATE TABLE IF NOT EXISTS anexos (
  id SERIAL PRIMARY KEY,
  solicitacao_id INTEGER REFERENCES solicitacoes(id),
  ordem_servico_id INTEGER REFERENCES ordens_servico(id),
  arquivo_nome VARCHAR(255) NOT NULL,
  arquivo_path TEXT NOT NULL,
  arquivo_tipo VARCHAR(100),
  tamanho_bytes INTEGER,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_anexos_solicitacao ON anexos (solicitacao_id);

-- Tabela de equipes
CREATE TABLE IF NOT EXISTS equipes (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  responsavel VARCHAR(100),
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Tabela de usuarios administrativos
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nome_completo VARCHAR(200) NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Funcao para atualizar automaticamente o campo atualizado_em
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar timestamps
CREATE TRIGGER update_postes_timestamp
  BEFORE UPDATE ON postes
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_solicitacoes_timestamp
  BEFORE UPDATE ON solicitacoes
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_ordens_servico_timestamp
  BEFORE UPDATE ON ordens_servico
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

