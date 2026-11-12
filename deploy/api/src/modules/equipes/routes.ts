import { Router, Request, Response } from 'express'
import { db } from '../../db.js'
import { authMiddleware, requireRole } from '../auth/middleware.js'
import {
  detectarColunasEquipe,
  processarFilaDistribuicao,
} from '../ordens_servico/distribuicao.js'
import { registrarAuditoria } from '../auditoria/helper.js'

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
  const {
    nome,
    descricao,
    responsavel,
    ativo,
    status_disponibilidade,
    capacidade_maxima,
    especialidades,
  } = req.body

  try {
    const antesResult = await db.query('SELECT * FROM equipes WHERE id = $1', [id])
    const antes = antesResult.rows[0] ?? null

    const sets: string[] = []
    const values: unknown[] = []
    function addSet(coluna: string, valor: unknown) {
      if (valor === undefined) return
      values.push(valor)
      sets.push(`${coluna} = COALESCE($${values.length}, ${coluna})`)
    }

    addSet('nome', nome)
    addSet('descricao', descricao)
    addSet('responsavel', responsavel)
    addSet('ativo', ativo)

    const colunas = await detectarColunasEquipe()
    if (colunas.disponibilidade) addSet('status_disponibilidade', status_disponibilidade)
    if (colunas.capacidade) addSet('capacidade_maxima', capacidade_maxima)
    if (colunas.especialidades) addSet('especialidades', especialidades)

    if (sets.length === 0) {
      res.status(400).json({ error: 'Nenhum campo para atualizar' })
      return
    }

    values.push(id)
    const result = await db.query(
      `UPDATE equipes
      SET ${sets.join(', ')}
      WHERE id = $${values.length}
      RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Equipe nao encontrada' })
      return
    }

    await registrarAuditoria({
      tabela: 'equipes',
      registroId: Number(id),
      acao: 'editar',
      dadosAntes: antes,
      dadosDepois: result.rows[0],
      usuarioId: req.user?.userId ?? null,
      usuarioNome: req.user?.nomeCompleto ?? req.user?.username ?? null,
    })

    const depois = result.rows[0] as { ativo?: boolean; status_disponibilidade?: string }
    const ficouDisponivel =
      depois.ativo !== false &&
      (depois.status_disponibilidade === undefined ||
        depois.status_disponibilidade === 'disponivel')

    let fila: Awaited<ReturnType<typeof processarFilaDistribuicao>> | null = null
    if (ficouDisponivel) {
      try {
        fila = await processarFilaDistribuicao()
      } catch (filaError) {
        console.error('[DISTRIBUICAO] Falha ao processar fila apos update de equipe:', filaError)
      }
    }

    res.json({ ...result.rows[0], fila_apos_update: fila })
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