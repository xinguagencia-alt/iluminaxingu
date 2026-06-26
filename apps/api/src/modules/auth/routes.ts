import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import { db } from '../../db'
import { getJwtSecret } from '../../config/env'
import { signToken } from './middleware'
import jwt from 'jsonwebtoken'

const router = Router()

// Bootstrap: criar primeiro admin (so funciona se nao houver nenhum)
router.post('/bootstrap', async (req: Request, res: Response) => {
  const { username, password, nomeCompleto } = req.body

  if (!username || !password || !nomeCompleto) {
    res.status(400).json({ error: 'Username, senha e nome completo sao obrigatorios' })
    return
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' })
    return
  }

  try {
    const existing = await db.query('SELECT COUNT(*) as count FROM admin_users')

    if (Number(existing.rows[0].count) > 0) {
      res.status(403).json({ error: 'Bootstrap ja foi realizado. Use o login para acessar.' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const result = await db.query(
      'INSERT INTO admin_users (username, password_hash, nome_completo) VALUES ($1, $2, $3) RETURNING id, username, nome_completo',
      [username, passwordHash, nomeCompleto]
    )

    const user = result.rows[0]
    const token = signToken({
      userId: user.id,
      username: user.username,
      nomeCompleto: user.nome_completo,
    })

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nomeCompleto: user.nome_completo,
      },
    })
  } catch (error) {
    console.error('Erro no bootstrap:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Verificar se bootstrap ja foi feito
router.get('/bootstrap', async (_req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT COUNT(*) as count FROM admin_users')
    res.json({ hasAdmins: Number(result.rows[0].count) > 0 })
  } catch (error) {
    console.error('Erro ao verificar admins:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Seed: criar ou resetar admin (protegido por SEED_SECRET)
router.post('/seed', async (req: Request, res: Response) => {
  const { secret } = req.body
  const seedSecret = process.env.SEED_SECRET

  if (!seedSecret || secret !== seedSecret) {
    res.status(403).json({ error: 'Secret invalido' })
    return
  }

  try {
    const existing = await db.query('SELECT id FROM admin_users WHERE username = $1', ['admin'])

    const passwordHash = await bcrypt.hash('admin123', 10)

    if (existing.rows.length > 0) {
      await db.query('UPDATE admin_users SET password_hash = $1, ativo = TRUE WHERE username = $2', [passwordHash, 'admin'])
      res.json({ message: 'Senha do admin resetada para admin123' })
    } else {
      await db.query(
        'INSERT INTO admin_users (username, password_hash, nome_completo) VALUES ($1, $2, $3)',
        ['admin', passwordHash, 'Administrador']
      )
      res.json({ message: 'Admin criado com sucesso' })
    }
  } catch (error) {
    console.error('Erro no seed:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body

  if (!username || !password) {
    res.status(400).json({ error: 'Username e senha sao obrigatorios' })
    return
  }

  try {
    const result = await db.query(
      'SELECT id, username, password_hash, nome_completo FROM admin_users WHERE username = $1 AND ativo = TRUE',
      [username]
    )

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Credenciais invalidas' })
      return
    }

    const user = result.rows[0]
    const validPassword = await bcrypt.compare(password, user.password_hash)

    if (!validPassword) {
      res.status(401).json({ error: 'Credenciais invalidas' })
      return
    }

    const token = signToken({
      userId: user.id,
      username: user.username,
      nomeCompleto: user.nome_completo,
    })

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nomeCompleto: user.nome_completo,
      },
    })
  } catch (error) {
    console.error('Erro ao fazer login:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token nao fornecido' })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = jwt.verify(token, getJwtSecret()) as { userId: number; username: string; nomeCompleto: string }

    const result = await db.query(
      'SELECT id, username, nome_completo FROM admin_users WHERE id = $1 AND ativo = TRUE',
      [payload.userId]
    )

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Usuario nao encontrado' })
      return
    }

    res.json({
      id: result.rows[0].id,
      username: result.rows[0].username,
      nomeCompleto: result.rows[0].nome_completo,
    })
  } catch {
    res.status(401).json({ error: 'Token invalido' })
  }
})

export default router
