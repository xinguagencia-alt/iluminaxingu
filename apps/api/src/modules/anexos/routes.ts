import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import rateLimit from 'express-rate-limit'
import { db } from '../../db.js'
import { authMiddleware, requireRole } from '../auth/middleware.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const uploadsDir = path.resolve(__dirname, '../../../uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.memoryStorage()

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ]
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Tipo de arquivo nao permitido'))
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
})

const router = Router()

const publicUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitos uploads. Tente novamente em 15 minutos.' },
})

router.post(
  '/upload',
  authMiddleware,
  requireRole(['admin', 'gestor', 'operador']),
  upload.single('arquivo'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado' })
      return
    }

    const { solicitacao_id, ordem_servico_id } = req.body

    if (!solicitacao_id && !ordem_servico_id) {
      res.status(400).json({ error: 'Informe solicitacao_id ou ordem_servico_id' })
      return
    }

    try {
      if (solicitacao_id) {
        const sol = await db.query('SELECT id FROM solicitacoes WHERE id = $1', [solicitacao_id])
        if (sol.rows.length === 0) {
          res.status(404).json({ error: 'Solicitacao nao encontrada' })
          return
        }
      }

      if (ordem_servico_id) {
        const os = await db.query('SELECT id FROM ordens_servico WHERE id = $1', [ordem_servico_id])
        if (os.rows.length === 0) {
          res.status(404).json({ error: 'Ordem de servico nao encontrada' })
          return
        }
      }

      const result = await db.query(
        `INSERT INTO anexos (solicitacao_id, ordem_servico_id, arquivo_nome, arquivo_path, arquivo_tipo, tamanho_bytes, arquivo_dados)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, solicitacao_id, ordem_servico_id, arquivo_nome, arquivo_path, arquivo_tipo, tamanho_bytes, criado_em`,
        [
          solicitacao_id ? Number(solicitacao_id) : null,
          ordem_servico_id ? Number(ordem_servico_id) : null,
          req.file.originalname,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
          req.file.buffer,
        ]
      )

      res.status(201).json(result.rows[0])
    } catch (error) {
      console.error('Erro ao salvar anexo:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }
)

router.post(
  '/upload-public',
  publicUploadLimiter,
  upload.single('arquivo'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado' })
      return
    }

    const { solicitacao_id } = req.body

    if (!solicitacao_id) {
      res.status(400).json({ error: 'Informe solicitacao_id' })
      return
    }

    try {
      const sol = await db.query('SELECT id FROM solicitacoes WHERE id = $1', [Number(solicitacao_id)])
      if (sol.rows.length === 0) {
        res.status(404).json({ error: 'Solicitacao nao encontrada' })
        return
      }

      const result = await db.query(
        `INSERT INTO anexos (solicitacao_id, arquivo_nome, arquivo_path, arquivo_tipo, tamanho_bytes, arquivo_dados)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, solicitacao_id, arquivo_nome, arquivo_path, arquivo_tipo, tamanho_bytes, criado_em`,
        [
          Number(solicitacao_id),
          req.file.originalname,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
          req.file.buffer,
        ]
      )

      res.status(201).json(result.rows[0])
    } catch (error) {
      console.error('Erro ao salvar anexo publico:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }
)

router.get('/:id/view', async (req: Request, res: Response) => {
  const id = String(req.params.id)
  try {
    const result = await db.query('SELECT * FROM anexos WHERE id = $1', [id])
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Anexo nao encontrado' })
      return
    }

    const anexo = result.rows[0]

    if (anexo.arquivo_dados) {
      res.setHeader('Content-Type', anexo.arquivo_tipo || 'application/octet-stream')
      res.setHeader('Cache-Control', 'public, max-age=3600')
      res.send(Buffer.from(anexo.arquivo_dados))
      return
    }

    const filePath = path.join(uploadsDir, anexo.arquivo_path)
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', anexo.arquivo_tipo || 'application/octet-stream')
      res.setHeader('Cache-Control', 'public, max-age=3600')
      fs.createReadStream(filePath).pipe(res)
      return
    }

    res.status(404).json({ error: 'Arquivo nao encontrado' })
  } catch (error) {
    console.error('Erro ao visualizar anexo:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.get('/:id/download', authMiddleware, requireRole(['admin', 'gestor', 'operador']), async (req: Request, res: Response) => {
  const id = String(req.params.id)
  try {
    const result = await db.query('SELECT * FROM anexos WHERE id = $1', [id])
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Anexo nao encontrado' })
      return
    }

    const anexo = result.rows[0]

    if (anexo.arquivo_dados) {
      res.setHeader('Content-Disposition', `attachment; filename="${anexo.arquivo_nome}"`)
      res.setHeader('Content-Type', anexo.arquivo_tipo || 'application/octet-stream')
      res.send(Buffer.from(anexo.arquivo_dados))
      return
    }

    const filePath = path.join(uploadsDir, anexo.arquivo_path)
    if (fs.existsSync(filePath)) {
      res.download(filePath, anexo.arquivo_nome)
      return
    }

    res.status(404).json({ error: 'Arquivo nao encontrado' })
  } catch (error) {
    console.error('Erro ao baixar anexo:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.delete('/:id', authMiddleware, requireRole(['admin', 'gestor']), async (req: Request, res: Response) => {
  const id = String(req.params.id)
  try {
    const result = await db.query('SELECT * FROM anexos WHERE id = $1', [id])
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Anexo nao encontrado' })
      return
    }

    const anexo = result.rows[0]

    if (!anexo.arquivo_dados) {
      const filePath = path.join(uploadsDir, anexo.arquivo_path)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    await db.query('DELETE FROM anexos WHERE id = $1', [id])
    res.json({ message: 'Anexo removido' })
  } catch (error) {
    console.error('Erro ao remover anexo:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
