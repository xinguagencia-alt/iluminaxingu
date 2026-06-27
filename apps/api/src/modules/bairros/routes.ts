import { Router, Request, Response } from 'express'
import { db } from '../../db'
import { authMiddleware, requireRole } from '../auth/middleware'
import { registrarAuditoria } from '../auditoria/helper'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, nome FROM bairros WHERE ativo = TRUE ORDER BY nome`
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao listar bairros:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.post('/', authMiddleware, requireRole(['admin', 'gestor']), async (req: Request, res: Response) => {
  const { nome } = req.body

  if (!nome || !nome.trim()) {
    res.status(400).json({ error: 'Nome do bairro e obrigatorio' })
    return
  }

  const nomeNormalizado = nome.trim()

  try {
    const existe = await db.query(
      `SELECT id FROM bairros
       WHERE unaccent(LOWER(nome)) = unaccent(LOWER($1)) AND ativo = TRUE`,
      [nomeNormalizado]
    )

    if (existe.rows.length > 0) {
      res.status(409).json({ error: 'Bairro ja existe' })
      return
    }

    const result = await db.query(
      `INSERT INTO bairros (nome) VALUES ($1) RETURNING id, nome`,
      [nomeNormalizado]
    )

    await registrarAuditoria({
      tabela: 'bairros',
      registroId: result.rows[0].id,
      acao: 'criar',
      dadosDepois: result.rows[0],
      usuarioId: req.user?.userId ?? null,
      usuarioNome: req.user?.nomeCompleto ?? null,
    })

    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Erro ao criar bairro:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.delete('/:id', authMiddleware, requireRole(['admin', 'gestor']), async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const result = await db.query(
      `UPDATE bairros SET ativo = FALSE WHERE id = $1 AND ativo = TRUE RETURNING id, nome`,
      [id]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Bairro nao encontrado' })
      return
    }

    await registrarAuditoria({
      tabela: 'bairros',
      registroId: Number(id),
      acao: 'excluir',
      dadosAntes: result.rows[0],
      usuarioId: req.user?.userId ?? null,
      usuarioNome: req.user?.nomeCompleto ?? null,
    })

    res.json({ ok: true })
  } catch (error) {
    console.error('Erro ao excluir bairro:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
