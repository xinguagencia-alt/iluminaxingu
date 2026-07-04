import { Router, Request, Response } from 'express'
import { db } from '../../db.js'
import { authMiddleware, requireRole } from '../auth/middleware.js'
import { registrarAuditoria } from '../auditoria/helper.js'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, nome, cor FROM bairros WHERE ativo = TRUE ORDER BY nome`
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao listar bairros:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.post('/', authMiddleware, requireRole(['admin', 'gestor']), async (req: Request, res: Response) => {
  const { nome, cor } = req.body

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
      `INSERT INTO bairros (nome, cor) VALUES ($1, $2) RETURNING id, nome, cor`,
      [nomeNormalizado, cor || null]
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

router.put('/:id', authMiddleware, requireRole(['admin', 'gestor']), async (req: Request, res: Response) => {
  const { id } = req.params
  const { nome, cor } = req.body

  try {
    const oldResult = await db.query(`SELECT id, nome, cor FROM bairros WHERE id = $1 AND ativo = TRUE`, [id])
    if (oldResult.rows.length === 0) {
      res.status(404).json({ error: 'Bairro nao encontrado' })
      return
    }

    const result = await db.query(
      `UPDATE bairros SET
        nome = COALESCE($1, nome),
        cor = COALESCE($2, cor)
      WHERE id = $3
      RETURNING id, nome, cor`,
      [nome?.trim() || null, cor || null, id]
    )

    await registrarAuditoria({
      tabela: 'bairros',
      registroId: Number(id),
      acao: 'editar',
      dadosAntes: oldResult.rows[0],
      dadosDepois: result.rows[0],
      usuarioId: req.user?.userId ?? null,
      usuarioNome: req.user?.nomeCompleto ?? null,
    })

    res.json(result.rows[0])
  } catch (error) {
    console.error('Erro ao atualizar bairro:', error)
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
