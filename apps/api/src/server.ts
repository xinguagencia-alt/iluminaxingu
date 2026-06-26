import cors from 'cors'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import authRoutes from './modules/auth/routes'
import { authMiddleware } from './modules/auth/middleware'
import solicitacoesRoutes from './modules/solicitacoes/routes'
import postesRoutes from './modules/postes/routes'
import ordensServicoRoutes from './modules/ordens_servico/routes'
import equipesRoutes from './modules/equipes/routes'
import anexosRoutes from './modules/anexos/routes'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = process.env.PORT || 3333

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  })
)
app.use(express.json())
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')))

// Rotas de saude
app.get('/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'iluminaxingu-api',
  })
})

// Tipos de problema (compatibilidade com frontend)
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

// Modulos
app.use('/api/auth', authRoutes)
app.use('/api/solicitacoes', solicitacoesRoutes)
app.use('/api/postes', postesRoutes)
app.use('/api/ordens-servico', authMiddleware, ordensServicoRoutes)
app.use('/api/equipes', authMiddleware, equipesRoutes)
app.use('/api/anexos', anexosRoutes)

// Rota legada (compatibilidade)
app.post('/api/requests', (request, response) => {
  const protocol = `ILX-${Date.now()}`
  response.status(201).json({
    protocol,
    status: 'enviada',
    receivedData: request.body,
  })
})

app.listen(port, () => {
  console.log(`IluminaXingu API running at http://localhost:${port}`)
})
