import { db } from './db.js'
import { criarTabelaAuditoria } from './modules/auditoria/helper.js'

export async function ensureDatabaseSchema() {
  await db.query(`CREATE EXTENSION IF NOT EXISTS unaccent`)
  await db.query(
    `ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS perfil VARCHAR(30) NOT NULL DEFAULT 'operador'`
  )
  await db.query("UPDATE admin_users SET perfil = 'admin' WHERE username = 'admin' AND perfil = 'operador'")

  await db.query(
    `ALTER TABLE postes
      ADD COLUMN IF NOT EXISTS rua VARCHAR(200),
      ADD COLUMN IF NOT EXISTS numero VARCHAR(30),
      ADD COLUMN IF NOT EXISTS bairro VARCHAR(120),
      ADD COLUMN IF NOT EXISTS complemento TEXT`
  )

  await db.query(
    `ALTER TABLE solicitacoes
      ADD COLUMN IF NOT EXISTS consentimento_lgpd BOOLEAN DEFAULT FALSE`
  )

  await db.query(
    `ALTER TABLE solicitacoes
      ALTER COLUMN geom DROP NOT NULL`
  ).catch(() => {})

  await db.query(
    `ALTER TABLE solicitacoes
      ADD COLUMN IF NOT EXISTS auto_identificado BOOLEAN DEFAULT FALSE`
  ).catch(() => {})

  await db.query(
    `ALTER TABLE ordens_servico
      ADD COLUMN IF NOT EXISTS material_utilizado TEXT`
  ).catch(() => {})

  await db.query(
    `ALTER TABLE anexos ADD COLUMN IF NOT EXISTS arquivo_dados BYTEA`
  ).catch(() => {})

  await db.query(
    `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ordens_servico_equipe_id_fk'
      ) THEN
        ALTER TABLE ordens_servico
          ADD CONSTRAINT ordens_servico_equipe_id_fk
          FOREIGN KEY (equipe_id) REFERENCES equipes(id);
      END IF;
    END$$`
  ).catch(() => {})

  await db.query(
    `CREATE TABLE IF NOT EXISTS bairros (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(120) UNIQUE NOT NULL,
      cor VARCHAR(7),
      ativo BOOLEAN DEFAULT TRUE,
      criado_em TIMESTAMP DEFAULT NOW()
    )`
  )
  await db.query(
    `ALTER TABLE bairros ADD COLUMN IF NOT EXISTS cor VARCHAR(7)`
  ).catch(() => {})
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_bairros_nome ON bairros (nome)`
  )
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_bairros_ativo ON bairros (ativo)`
  )
  await db.query(
    `INSERT INTO bairros (nome) VALUES
      ('Aeroporto'),
      ('Atalaia'),
      ('Bela Vista'),
      ('Centro'),
      ('Jardim Novo Planalto'),
      ('Liberdade'),
      ('Minerador'),
      ('Montenegro'),
      ('Primavera'),
      ('Rodoviário'),
      ('São José'),
      ('Triângulo'),
      ('Vale da Serra (Cai N''Água)')
    ON CONFLICT (nome) DO NOTHING`
  )

  await db.query(
    `UPDATE bairros SET cor = CASE nome
      WHEN 'Aeroporto' THEN '#e74c3c'
      WHEN 'Atalaia' THEN '#e67e22'
      WHEN 'Bela Vista' THEN '#f1c40f'
      WHEN 'Centro' THEN '#2ecc71'
      WHEN 'Jardim Novo Planalto' THEN '#1abc9c'
      WHEN 'Liberdade' THEN '#3498db'
      WHEN 'Minerador' THEN '#9b59b6'
      WHEN 'Montenegro' THEN '#e91e63'
      WHEN 'Primavera' THEN '#00bcd4'
      WHEN 'Rodoviário' THEN '#ff9800'
      WHEN 'São José' THEN '#8bc34a'
      WHEN 'Triângulo' THEN '#673ab7'
      WHEN 'Vale da Serra (Cai N''Água)' THEN '#795548'
    END
    WHERE cor IS NULL AND ativo = TRUE`
  ).catch(() => {})

  await db.query(
    `CREATE TABLE IF NOT EXISTS ruas (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(200) NOT NULL,
      tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('avenida', 'rua')),
      ativo BOOLEAN DEFAULT TRUE,
      criado_em TIMESTAMP DEFAULT NOW(),
      UNIQUE (nome, tipo)
    )`
  )
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_ruas_nome ON ruas (nome)`
  )
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_ruas_tipo ON ruas (tipo)`
  )
  await db.query(
    `INSERT INTO ruas (nome, tipo) VALUES
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
      ('Avenida Serra', 'avenida'),
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
    ON CONFLICT (nome, tipo) DO NOTHING`
  )

  await db.query(
    `UPDATE postes SET latitude = '-6.6410607', longitude = '-51.9858841'
     WHERE codigo = 'POSTE-J8EL6T' AND latitude IS NULL`
  ).catch(() => {})

  await criarTabelaAuditoria()

  // Estoque
  await db.query(
    `CREATE TABLE IF NOT EXISTS configuracao_estoque (
      id SERIAL PRIMARY KEY,
      chave VARCHAR(50) UNIQUE NOT NULL,
      valor VARCHAR(200) NOT NULL,
      descricao TEXT,
      criado_em TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW()
    )`
  ).catch(() => {})
  await db.query(
    `INSERT INTO configuracao_estoque (chave, valor, descricao) VALUES
      ('estoque_ativo', 'false', 'Modulo de estoque habilitado')
    ON CONFLICT (chave) DO NOTHING`
  ).catch(() => {})

  await db.query(
    `CREATE TABLE IF NOT EXISTS itens_estoque (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(150) NOT NULL,
      categoria VARCHAR(50) NOT NULL,
      unidade_medida VARCHAR(30) NOT NULL,
      estoque_minimo NUMERIC(10,2) DEFAULT 0,
      estoque_atual NUMERIC(10,2) DEFAULT 0,
      ativo BOOLEAN DEFAULT TRUE,
      observacao TEXT,
      codigo_interno VARCHAR(50),
      criado_em TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW()
    )`
  ).catch(() => {})

  await db.query(
    `CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES itens_estoque(id),
      tipo VARCHAR(20) NOT NULL,
      quantidade NUMERIC(10,2) NOT NULL,
      saldo_anterior NUMERIC(10,2) NOT NULL,
      saldo_posterior NUMERIC(10,2) NOT NULL,
      observacao TEXT,
      os_id INTEGER,
      nota_fiscal VARCHAR(50),
      fornecedor VARCHAR(150),
      usuario VARCHAR(100),
      data_movimento TIMESTAMP DEFAULT NOW(),
      criado_em TIMESTAMP DEFAULT NOW()
    )`
  ).catch(() => {})

  await db.query(
    `CREATE TABLE IF NOT EXISTS itens_usados_os (
      id SERIAL PRIMARY KEY,
      os_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL REFERENCES itens_estoque(id),
      quantidade NUMERIC(10,2) NOT NULL,
      usuario VARCHAR(100),
      observacao TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    )`
  ).catch(() => {})
  await db.query(
    `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'itens_usados_os_os_item_uniq'
      ) THEN
        ALTER TABLE itens_usados_os
          ADD CONSTRAINT itens_usados_os_os_item_uniq UNIQUE (os_id, item_id);
      END IF;
    END$$`
  ).catch(() => {})
}
