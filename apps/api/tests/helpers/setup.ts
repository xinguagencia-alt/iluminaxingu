import pg from 'pg'
import { newDb, type IMemoryDb } from 'pg-mem'

process.env.NODE_ENV = process.env.NODE_ENV || 'test'
process.env.DB_USER = process.env.DB_USER || 'iluminaxingu'
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'iluminaxingu'
process.env.DB_NAME = process.env.DB_NAME || 'iluminaxingu'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-teste-local'
process.env.RATE_LIMIT_SOLICITACAO_MAX =
  process.env.RATE_LIMIT_SOLICITACAO_MAX || '1000'
delete process.env.NOTIFICATION_EMAIL_TO
delete process.env.SMTP_HOST
delete process.env.SMTP_USER
delete process.env.SMTP_PASS
delete process.env.DATABASE_URL

const mem: IMemoryDb = newDb()

const adaptador = mem.adapters.createPg()
;(pg as unknown as { Pool: unknown }).Pool = adaptador.Pool

const DDL = [
  `CREATE TABLE solicitacoes (
    id SERIAL PRIMARY KEY,
    protocolo VARCHAR(20) UNIQUE NOT NULL,
    nome_solicitante VARCHAR(200) NOT NULL,
    telefone VARCHAR(20),
    email VARCHAR(200),
    poste_id INTEGER,
    codigo_poste_informado VARCHAR(50),
    endereco_informado TEXT,
    latitude DECIMAL,
    longitude DECIMAL,
    tipo_problema VARCHAR(50) NOT NULL,
    descricao TEXT,
    status_atual VARCHAR(30) DEFAULT 'enviada',
    prioridade VARCHAR(10) DEFAULT 'media',
    origem_canal VARCHAR(30) DEFAULT 'web',
    consentimento_lgpd BOOLEAN DEFAULT FALSE,
    auto_identificado BOOLEAN DEFAULT FALSE,
    client_request_id VARCHAR(64),
    confirmacoes_elevacao_em TIMESTAMP,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX idx_solicitacoes_client_request_id
    ON solicitacoes (client_request_id)
    WHERE client_request_id IS NOT NULL`,
  `CREATE TABLE confirmacoes (
    id SERIAL PRIMARY KEY,
    solicitacao_id INTEGER NOT NULL REFERENCES solicitacoes (id) ON DELETE CASCADE,
    telefone_normalizado VARCHAR(20) NOT NULL,
    origem VARCHAR(20) NOT NULL DEFAULT 'portal',
    client_request_id VARCHAR(64),
    criado_em TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX idx_confirmacoes_solicitacao_telefone_unico
    ON confirmacoes (solicitacao_id, telefone_normalizado)`,
  `CREATE TABLE status_logs (
    id SERIAL PRIMARY KEY,
    solicitacao_id INTEGER NOT NULL,
    status_anterior VARCHAR(30),
    status_novo VARCHAR(30) NOT NULL,
    observacao TEXT,
    criado_por VARCHAR(100),
    criado_em TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE ordens_servico (
    id SERIAL PRIMARY KEY,
    solicitacao_id INTEGER NOT NULL,
    equipe_id INTEGER,
    status VARCHAR(30) DEFAULT 'aberta',
    data_abertura TIMESTAMP DEFAULT NOW(),
    data_execucao TIMESTAMP,
    data_encerramento TIMESTAMP,
    observacao_execucao TEXT,
    resultado VARCHAR(50),
    material_utilizado TEXT,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE equipes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    descricao TEXT,
    responsavel VARCHAR(120),
    telefone VARCHAR(20),
    ativo BOOLEAN DEFAULT TRUE,
    status_disponibilidade VARCHAR(30) NOT NULL DEFAULT 'disponivel',
    capacidade_maxima INTEGER NOT NULL DEFAULT 3,
    especialidades VARCHAR(500),
    criado_em TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX idx_ordens_servico_solicitacao_id_unico
    ON ordens_servico (solicitacao_id)`,
  `CREATE TABLE postes (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    endereco TEXT,
    rua VARCHAR(200),
    numero VARCHAR(20),
    bairro VARCHAR(100),
    complemento VARCHAR(200),
    latitude DECIMAL,
    longitude DECIMAL,
    status_ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE anexos (
    id SERIAL PRIMARY KEY,
    solicitacao_id INTEGER,
    ordem_servico_id INTEGER,
    arquivo_nome VARCHAR(255),
    arquivo_path VARCHAR(255),
    arquivo_tipo VARCHAR(100),
    tamanho_bytes INTEGER,
    arquivo_dados BYTEA,
    criado_em TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(60) UNIQUE NOT NULL,
    password_hash VARCHAR(200),
    nome_completo VARCHAR(120),
    perfil VARCHAR(30) DEFAULT 'operador',
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE configuracao_estoque (
    id SERIAL PRIMARY KEY,
    chave VARCHAR(50) UNIQUE NOT NULL,
    valor VARCHAR(200) NOT NULL,
    descricao TEXT,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE auditoria (
    id SERIAL PRIMARY KEY,
    tabela VARCHAR(50) NOT NULL,
    registro_id INTEGER,
    acao VARCHAR(20) NOT NULL,
    dados_antes JSONB,
    dados_depois JSONB,
    usuario_id INTEGER,
    usuario_nome VARCHAR(100),
    criado_em TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE itens_estoque (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    unidade_medida VARCHAR(30) NOT NULL,
    estoque_minimo NUMERIC DEFAULT 0,
    estoque_atual NUMERIC DEFAULT 0,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE movimentacoes_estoque (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    quantidade NUMERIC NOT NULL,
    saldo_anterior NUMERIC NOT NULL,
    saldo_posterior NUMERIC NOT NULL,
    os_id INTEGER,
    criado_em TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE itens_usados_os (
    id SERIAL PRIMARY KEY,
    os_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantidade NUMERIC NOT NULL,
    criado_em TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE bairros (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) UNIQUE NOT NULL,
    cor VARCHAR(7),
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE ruas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(200) NOT NULL,
    tipo VARCHAR(10) NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT NOW()
  )`,
]

for (const ddl of DDL) {
  mem.public.none(ddl)
}

type PoolTeste = {
  query(sql: string, valores?: unknown[]): Promise<pg.QueryResult>
}

const pool = new (adaptador.Pool as unknown as new () => PoolTeste)()

export async function executar(sql: string, valores?: unknown[]): Promise<pg.QueryResult> {
  return pool.query(sql, valores)
}

export { mem }

