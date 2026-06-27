import { Router, Request, Response } from 'express'
import { db } from '../../db'
import { authMiddleware, requireRole } from '../auth/middleware'
import { registrarAuditoria } from '../auditoria/helper'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  try {
    const tipo = req.query.tipo as string | undefined

    let query = `SELECT id, nome, tipo FROM ruas WHERE ativo = TRUE`
    const params: string[] = []

    if (tipo === 'avenida' || tipo === 'rua') {
      params.push(tipo)
      query += ` AND tipo = $1`
    }

    query += ` ORDER BY tipo, nome`

    const result = await db.query(query, params)
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao listar ruas:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.post('/', authMiddleware, requireRole(['admin', 'gestor']), async (req: Request, res: Response) => {
  const { nome, tipo } = req.body

  if (!nome || !nome.trim()) {
    res.status(400).json({ error: 'Nome da rua/avenida e obrigatorio' })
    return
  }

  if (tipo !== 'avenida' && tipo !== 'rua') {
    res.status(400).json({ error: 'Tipo deve ser "avenida" ou "rua"' })
    return
  }

  const nomeNormalizado = nome.trim()

  try {
    const existe = await db.query(
      `SELECT id FROM ruas
       WHERE unaccent(LOWER(nome)) = unaccent(LOWER($1)) AND tipo = $2 AND ativo = TRUE`,
      [nomeNormalizado, tipo]
    )

    if (existe.rows.length > 0) {
      res.status(409).json({ error: 'Rua/avenida ja existe' })
      return
    }

    const result = await db.query(
      `INSERT INTO ruas (nome, tipo) VALUES ($1, $2) RETURNING id, nome, tipo`,
      [nomeNormalizado, tipo]
    )

    await registrarAuditoria({
      tabela: 'ruas',
      registroId: result.rows[0].id,
      acao: 'criar',
      dadosDepois: result.rows[0],
      usuarioId: req.user?.userId ?? null,
      usuarioNome: req.user?.nomeCompleto ?? null,
    })

    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Erro ao criar rua/avenida:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.delete('/:id', authMiddleware, requireRole(['admin', 'gestor']), async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const result = await db.query(
      `UPDATE ruas SET ativo = FALSE WHERE id = $1 AND ativo = TRUE RETURNING id, nome, tipo`,
      [id]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Rua/avenida nao encontrada' })
      return
    }

    await registrarAuditoria({
      tabela: 'ruas',
      registroId: Number(id),
      acao: 'excluir',
      dadosAntes: result.rows[0],
      usuarioId: req.user?.userId ?? null,
      usuarioNome: req.user?.nomeCompleto ?? null,
    })

    res.json({ ok: true })
  } catch (error) {
    console.error('Erro ao excluir rua/avenida:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
