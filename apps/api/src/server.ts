import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import authRoutes from './modules/auth/routes.js'
import { authMiddleware } from './modules/auth/middleware.js'
import solicitacoesRoutes from './modules/solicitacoes/routes.js'
import postesRoutes from './modules/postes/routes.js'
import ordensServicoRoutes from './modules/ordens_servico/routes.js'
import equipesRoutes from './modules/equipes/routes.js'
import bairrosRoutes from './modules/bairros/routes.js'
import ruasRoutes from './modules/ruas/routes.js'
import anexosRoutes from './modules/anexos/routes.js'
import auditoriaRoutes from './modules/auditoria/routes.js'
import exportRoutes from './modules/export/routes.js'
import { criarTabelaAuditoria } from './modules/auditoria/helper.js'
import { db } from './db.js'

const app = express()
const port = process.env.PORT || 3333

app.set('trust proxy', 1)
app.use(helmet())

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisicoes. Tente novamente em 15 minutos.' },
})
app.use(globalLimiter)

async function ensureDatabaseSchema() {
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
      ativo BOOLEAN DEFAULT TRUE,
      criado_em TIMESTAMP DEFAULT NOW()
    )`
  )
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

  await criarTabelaAuditoria()
}

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  })
)
app.use(express.json({ limit: '1mb' }))

app.get('/health', async (_request, response) => {
  let columns: string[] = []
  try {
    const result = await db.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'solicitacoes' ORDER BY ordinal_position`
    )
    columns = result.rows.map((r: { column_name: string }) => r.column_name)
  } catch { /* ignore */ }

  response.json({
    status: 'ok',
    service: 'iluminaxingu-api',
    deploy: 'v5-fechamento-os',
    solicitacoes_columns: columns,
  })
})

app.get('/api/problem-types', (_request, response) => {
  response.json([
    { value: 'poste_danificado', label: 'Poste danificado' },
    { value: 'lampada_apagada', label: 'Lampada apagada' },
    { value: 'lampada_piscando', label: 'Lampada piscando' },
    { value: 'risco_eletrico', label: 'Risco eletrico' },
    { value: 'fio_exposto', label: 'Fio exposto' },
    { value: 'outro', label: 'Outro' },
  ])
})

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
})

app.use('/api/auth/login', loginLimiter)
app.use('/api/auth', authRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/solicitacoes', solicitacoesRoutes)
app.use('/api/postes', postesRoutes)
app.use('/api/ordens-servico', authMiddleware, ordensServicoRoutes)
app.use('/api/equipes', authMiddleware, equipesRoutes)
app.use('/api/bairros', bairrosRoutes)
app.use('/api/ruas', ruasRoutes)
app.use('/api/anexos', anexosRoutes)
app.use('/api/auditoria', auditoriaRoutes)
app.use('/api/export', exportRoutes)

ensureDatabaseSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`IluminaXingu API running at http://localhost:${port}`)
    })
  })
  .catch((error) => {
    console.error('Erro ao preparar banco de dados:', error)
    process.exit(1)
  })

