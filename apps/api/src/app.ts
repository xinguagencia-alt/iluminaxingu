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
import estoqueRoutes from './modules/estoque/routes.js'
import dashboardRoutes from './modules/dashboard/routes.js'

export function createApp() {
  const app = express()
  const serverStartedAt = new Date().toISOString()

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

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    })
  )
  app.use(express.json({ limit: '1mb' }))

  app.get('/health', async (_request, response) => {
    const { db } = await import('./db.js')
    let columns: string[] = []
    let bairrosColumns: string[] = []
    let postesColumns: string[] = []
    try {
      const result = await db.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'solicitacoes' ORDER BY ordinal_position`
      )
      columns = result.rows.map((r: { column_name: string }) => r.column_name)
    } catch { /* ignore */ }
    try {
      const result = await db.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'bairros' ORDER BY ordinal_position`
      )
      bairrosColumns = result.rows.map((r: { column_name: string }) => r.column_name)
    } catch { /* ignore */ }
    try {
      const result = await db.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'postes' ORDER BY ordinal_position`
      )
      postesColumns = result.rows.map((r: { column_name: string }) => r.column_name)
    } catch { /* ignore */ }

    response.json({
      status: 'ok',
      service: 'iluminaxingu-api',
      deploy: 'v15-vercel',
      started_at: serverStartedAt,
      modules: ['solicitacoes', 'postes', 'ordens_servico', 'equipes', 'bairros', 'ruas', 'anexos', 'auditoria', 'export', 'estoque', 'dashboard'],
      solicitacoes_columns: columns,
      bairros_columns: bairrosColumns,
      postes_columns: postesColumns,
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
  app.use('/api/dashboard', authMiddleware, dashboardRoutes)
  app.use('/api/solicitacoes', solicitacoesRoutes)
  app.use('/api/postes', postesRoutes)
  app.use('/api/ordens-servico', authMiddleware, ordensServicoRoutes)
  app.use('/api/equipes', authMiddleware, equipesRoutes)
  app.use('/api/bairros', bairrosRoutes)
  app.use('/api/ruas', ruasRoutes)
  app.use('/api/anexos', anexosRoutes)
  app.use('/api/auditoria', auditoriaRoutes)
  app.use('/api/export', exportRoutes)
  app.use('/api/estoque', authMiddleware, estoqueRoutes)

  return app
}
