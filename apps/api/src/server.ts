import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import authRoutes from './modules/auth/routes.js'
import { authMiddleware, requireRole } from './modules/auth/middleware.js'
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
    `ALTER TABLE ordens_servico
      ADD COLUMN IF NOT EXISTS material_utilizado TEXT`
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

// TEMPORARIO - Endpoint de limpeza de dados de teste
app.get('/api/admin/clean-test-data', authMiddleware, requireRole(['admin']), async (_req, res) => {
  try {
    const solicitacoes = await db.query('SELECT id, protocolo FROM solicitacoes ORDER BY id')
    const ordens = await db.query('SELECT id, solicitacao_id FROM ordens_servico ORDER BY id')
    const anexos = await db.query('SELECT id, solicitacao_id, ordem_servico_id, arquivo_path FROM anexos ORDER BY id')
    const logs = await db.query('SELECT id, solicitacao_id FROM status_logs ORDER BY id')
    res.json({
      message: 'Dados que serao excluidos:',
      solicitacoes: solicitacoes.rows,
      ordens_servico: ordens.rows,
      anexos: anexos.rows,
      status_logs: logs.rows,
    })
  } catch (error) {
    res.status(500).json({ error: String(error) })
  }
})

app.post('/api/admin/clean-test-data', authMiddleware, requireRole(['admin']), async (_req, res) => {
  const __filename = fileURLToPath(import.meta.url)
  const uploadsDir = path.resolve(path.dirname(__filename), '../../../uploads')
  try {
    const anexos = await db.query('SELECT arquivo_path FROM anexos')
    let filesDeleted = 0
    for (const row of anexos.rows) {
      const filePath = path.join(uploadsDir, (row as { arquivo_path: string }).arquivo_path)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        filesDeleted++
      }
    }
    await db.query('DELETE FROM anexos')
    await db.query('DELETE FROM status_logs')
    await db.query('DELETE FROM ordens_servico')
    await db.query('DELETE FROM solicitacoes')
    await db.query("SELECT setval('solicitacoes_id_seq', 1, false)")
    await db.query("SELECT setval('ordens_servico_id_seq', 1, false)")
    await db.query("SELECT setval('anexos_id_seq', 1, false)")
    await db.query("SELECT setval('status_logs_id_seq', 1, false)")
    res.json({
      message: 'Dados de teste excluidos com sucesso',
      files_deleted: filesDeleted,
    })
  } catch (error) {
    res.status(500).json({ error: String(error) })
  }
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

const bootstrapLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Muitas tentativas de bootstrap. Aguarde 1 hora.' },
})

app.use('/api/auth/login', loginLimiter)
app.use('/api/auth/bootstrap', bootstrapLimiter)
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

