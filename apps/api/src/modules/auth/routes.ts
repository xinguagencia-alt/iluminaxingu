import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import { db } from '../../db'
import { getJwtSecret } from '../../config/env'
import { authMiddleware, requireRole, signToken } from './middleware'
import jwt from 'jsonwebtoken'

const router = Router()
const PERFIS_VALIDOS = ['admin', 'gestor', 'operador', 'consulta']

function normalizePerfil(perfil?: string) {
  return PERFIS_VALIDOS.includes(perfil || '') ? perfil! : 'operador'
}

function mapUser(row: Record<string, unknown>) {
  return {
    id: row.id,
    username: row.username,
    nomeCompleto: row.nome_completo,
    perfil: row.perfil || 'operador',
    ativo: row.ativo,
    criadoEm: row.criado_em,
  }
}

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
      'INSERT INTO admin_users (username, password_hash, nome_completo, perfil) VALUES ($1, $2, $3, $4) RETURNING id, username, nome_completo, perfil',
      [username, passwordHash, nomeCompleto, 'admin']
    )

    const user = result.rows[0]
    const token = signToken({
      userId: user.id,
      username: user.username,
      nomeCompleto: user.nome_completo,
      perfil: user.perfil,
    })

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nomeCompleto: user.nome_completo,
        perfil: user.perfil,
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

// Seed: criar ou resetar admin (protegido por SEED_SECRET, apenas em dev)
router.post('/seed', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Endpoint indisponivel em producao' })
    return
  }

  const { secret } = req.body
  const seedSecret = process.env.SEED_SECRET

  if (!seedSecret) {
    res.status(403).json({ error: 'SEED_SECRET nao configurado. Seed indisponivel.' })
    return
  }

  if (secret !== seedSecret) {
    res.status(403).json({ error: 'Secret invalido' })
    return
  }

  const { password } = req.body

  if (!password) {
    res.status(400).json({ error: 'Senha e obrigatoria. Envie "password" no body.' })
    return
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres' })
    return
  }

  try {
    const existing = await db.query('SELECT id FROM admin_users WHERE username = $1', ['admin'])
    const passwordHash = await bcrypt.hash(password, 10)

    if (existing.rows.length > 0) {
      await db.query(
        'UPDATE admin_users SET password_hash = $1, ativo = TRUE, perfil = $2 WHERE username = $3',
        [passwordHash, 'admin', 'admin']
      )
      res.json({ message: 'Senha do admin atualizada' })
    } else {
      await db.query(
        'INSERT INTO admin_users (username, password_hash, nome_completo, perfil) VALUES ($1, $2, $3, $4)',
        ['admin', passwordHash, 'Administrador', 'admin']
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
      'SELECT id, username, password_hash, nome_completo, perfil FROM admin_users WHERE username = $1 AND ativo = TRUE',
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
      perfil: user.perfil,
    })

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nomeCompleto: user.nome_completo,
        perfil: user.perfil,
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
    const payload = jwt.verify(token, getJwtSecret()) as { userId: number; username: string; nomeCompleto: string; perfil: string }

    const result = await db.query(
      'SELECT id, username, nome_completo, perfil FROM admin_users WHERE id = $1 AND ativo = TRUE',
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
      perfil: result.rows[0].perfil,
    })
  } catch {
    res.status(401).json({ error: 'Token invalido' })
  }
})

router.get('/users', authMiddleware, requireRole(['admin']), async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      'SELECT id, username, nome_completo, perfil, ativo, criado_em FROM admin_users ORDER BY nome_completo ASC'
    )
    res.json(result.rows.map(mapUser))
  } catch (error) {
    console.error('Erro ao listar usuarios:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.post('/users', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  const { username, password, nomeCompleto, perfil } = req.body

  if (!username || !password || !nomeCompleto) {
    res.status(400).json({ error: 'Usuario, senha e nome completo sao obrigatorios' })
    return
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' })
    return
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10)
    const result = await db.query(
      `INSERT INTO admin_users (username, password_hash, nome_completo, perfil)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, nome_completo, perfil, ativo, criado_em`,
      [username.trim(), passwordHash, nomeCompleto.trim(), normalizePerfil(perfil)]
    )

    res.status(201).json(mapUser(result.rows[0]))
  } catch (error: unknown) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      res.status(409).json({ error: 'Este usuario ja existe' })
      return
    }

    console.error('Erro ao criar usuario:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.put('/users/:id', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { username, password, nomeCompleto, perfil, ativo } = req.body

  if (!id) {
    res.status(400).json({ error: 'Usuario invalido' })
    return
  }

  if (password && password.length < 6) {
    res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' })
    return
  }

  if (req.user?.userId === id && ativo === false) {
    res.status(400).json({ error: 'Voce nao pode desativar seu proprio usuario' })
    return
  }

  try {
    const fields: string[] = []
    const values: unknown[] = []

    if (username !== undefined) {
      values.push(String(username).trim())
      fields.push(`username = $${values.length}`)
    }

    if (nomeCompleto !== undefined) {
      values.push(String(nomeCompleto).trim())
      fields.push(`nome_completo = $${values.length}`)
    }

    if (perfil !== undefined) {
      values.push(normalizePerfil(perfil))
      fields.push(`perfil = $${values.length}`)
    }

    if (ativo !== undefined) {
      values.push(Boolean(ativo))
      fields.push(`ativo = $${values.length}`)
    }

    if (password) {
      values.push(await bcrypt.hash(password, 10))
      fields.push(`password_hash = $${values.length}`)
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'Nenhum dado enviado para atualizar' })
      return
    }

    values.push(id)
    const result = await db.query(
      `UPDATE admin_users SET ${fields.join(', ')} WHERE id = $${values.length}
       RETURNING id, username, nome_completo, perfil, ativo, criado_em`,
      values
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Usuario nao encontrado' })
      return
    }

    res.json(mapUser(result.rows[0]))
  } catch (error: unknown) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      res.status(409).json({ error: 'Este usuario ja existe' })
      return
    }

    console.error('Erro ao atualizar usuario:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Migration: adicionar colunas de endereco estruturado (protegido por SEED_SECRET)
router.post('/migrate', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Endpoint indisponivel em producao' })
    return
  }

  const { secret } = req.body
  const seedSecret = process.env.SEED_SECRET

  if (!seedSecret || secret !== seedSecret) {
    res.status(403).json({ error: 'Secret invalido' })
    return
  }

  const migrations = [
    `ALTER TABLE postes ADD COLUMN IF NOT EXISTS rua VARCHAR(200)`,
    `ALTER TABLE postes ADD COLUMN IF NOT EXISTS numero VARCHAR(20)`,
    `ALTER TABLE postes ADD COLUMN IF NOT EXISTS bairro VARCHAR(100)`,
    `ALTER TABLE postes ADD COLUMN IF NOT EXISTS complemento VARCHAR(200)`,
    `CREATE INDEX IF NOT EXISTS idx_postes_bairro ON postes (bairro)`,
  ]

  const results: string[] = []

  try {
    for (const sql of migrations) {
      await db.query(sql)
      results.push(`OK: ${sql.substring(0, 50)}...`)
    }
    res.json({ message: 'Migration executada com sucesso', results })
  } catch (error) {
    console.error('Erro na migration:', error)
    res.status(500).json({ error: 'Erro na migration', results })
  }
})

export default router

