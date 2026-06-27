import { Router, Request, Response } from 'express'
import { db } from '../../db'
import { authMiddleware, requireRole } from '../auth/middleware'

const router = Router()

router.get('/', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit)) || 50, 200)
    const offset = parseInt(String(req.query.offset)) || 0
    const tabela = req.query.tabela as string | undefined
    const usuario = req.query.usuario as string | undefined

    let query = `SELECT id, tabela, registro_id, acao, dados_antes, dados_depois, usuario_id, usuario_nome, criado_em FROM auditoria`
    const conditions: string[] = []
    const params: unknown[] = []

    if (tabela) {
      params.push(tabela)
      conditions.push(`tabela = $${params.length}`)
    }

    if (usuario) {
      params.push(usuario)
      conditions.push(`usuario_nome ILIKE '%' || $${params.length} || '%'`)
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`
    }

    query += ` ORDER BY criado_em DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    const countQuery = `SELECT COUNT(*) as total FROM auditoria${conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''}`
    const countResult = await db.query(countQuery, params.slice(0, conditions.length))

    res.json({
      logs: result.rows,
      total: Number(countResult.rows[0].total),
      limit,
      offset,
    })
  } catch (error) {
    console.error('Erro ao consultar auditoria:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
