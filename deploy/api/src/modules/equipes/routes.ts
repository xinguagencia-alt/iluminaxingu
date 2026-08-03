import { Router, Request, Response } from 'express'
import { db } from '../../db.js'
import { authMiddleware, requireRole } from '../auth/middleware.js'

const router = Router()

// Listar todas as equipes ativas
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      'SELECT * FROM equipes WHERE ativo = true ORDER BY nome'
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao listar equipes:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Buscar equipe por ID
router.get('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id)
  try {
    const result = await db.query('SELECT * FROM equipes WHERE id = $1', [id])
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Equipe nao encontrada' })
      return
    }
    res.json(result.rows[0])
  } catch (error) {
    console.error('Erro ao buscar equipe:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Criar nova equipe
router.post('/', authMiddleware, requireRole(['admin', 'gestor']), async (req: Request, res: Response) => {
  const { nome, descricao, responsavel } = req.body

  if (!nome) {
    res.status(400).json({ error: 'Nome da equipe e obrigatorio' })
    return
  }

  try {
    const result = await db.query(
      `INSERT INTO equipes (nome, descricao, responsavel)
      VALUES ($1, $2, $3)
      RETURNING *`,
      [nome, descricao || null, responsavel || null]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Erro ao criar equipe:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Atualizar equipe
router.put('/:id', authMiddleware, requireRole(['admin', 'gestor']), async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const { nome, descricao, responsavel, ativo } = req.body

  try {
    const result = await db.query(
      `UPDATE equipes
      SET nome = COALESCE($1, nome),
          descricao = COALESCE($2, descricao),
          responsavel = COALESCE($3, responsavel),
          ativo = COALESCE($4, ativo)
      WHERE id = $5
      RETURNING *`,
      [nome, descricao, responsavel, ativo, id]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Equipe nao encontrada' })
      return
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Erro ao atualizar equipe:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Desativar equipe (soft delete)
router.delete('/:id', authMiddleware, requireRole(['admin', 'gestor']), async (req: Request, res: Response) => {
  const id = String(req.params.id)
  try {
    const result = await db.query(
      'UPDATE equipes SET ativo = false WHERE id = $1 RETURNING id',
      [id]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Equipe nao encontrada' })
      return
    }

    res.json({ message: 'Equipe desativada com sucesso' })
  } catch (error) {
    console.error('Erro ao desativar equipe:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router