import cors from 'cors'
import express from 'express'
import authRoutes from './modules/auth/routes'
import { authMiddleware } from './modules/auth/middleware'
import solicitacoesRoutes from './modules/solicitacoes/routes'
import postesRoutes from './modules/postes/routes'
import ordensServicoRoutes from './modules/ordens_servico/routes'
import equipesRoutes from './modules/equipes/routes'
import anexosRoutes from './modules/anexos/routes'
import { db } from './db'

const app = express()
const port = process.env.PORT || 3333

async function ensureDatabaseSchema() {
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
}

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  })
)
app.use(express.json())

app.get('/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'iluminaxingu-api',
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

app.use('/api/auth', authRoutes)
app.use('/api/solicitacoes', solicitacoesRoutes)
app.use('/api/postes', postesRoutes)
app.use('/api/ordens-servico', authMiddleware, ordensServicoRoutes)
app.use('/api/equipes', authMiddleware, equipesRoutes)
app.use('/api/anexos', anexosRoutes)

app.post('/api/requests', (request, response) => {
  const protocol = `ILX-${Date.now()}`
  response.status(201).json({
    protocol,
    status: 'enviada',
    receivedData: request.body,
  })
})

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

