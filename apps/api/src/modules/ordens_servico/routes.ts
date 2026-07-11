import { Router, Request, Response } from 'express'
import { db } from '../../db.js'
import { authMiddleware, requireRole } from '../auth/middleware.js'
import { notificarStatusSolicitacao } from '../notificacoes/notificacoes.js'

const router = Router()

// Listar postes reparados por equipe
router.get('/postes-reparados', async (req: Request, res: Response) => {
  const { equipe_id, data_inicio, data_fim } = req.query

  const conditions: string[] = ["os.status = 'concluida'", "os.equipe_id IS NOT NULL"]
  const values: unknown[] = []
  let paramIndex = 1

  if (equipe_id && typeof equipe_id === 'string') {
    conditions.push(`os.equipe_id = $${paramIndex}`)
    values.push(Number(equipe_id))
    paramIndex++
  }

  if (data_inicio && typeof data_inicio === 'string') {
    conditions.push(`os.data_abertura >= $${paramIndex}`)
    values.push(data_inicio)
    paramIndex++
  }

  if (data_fim && typeof data_fim === 'string') {
    conditions.push(`os.data_abertura <= $${paramIndex}`)
    values.push(data_fim)
    paramIndex++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  try {
    const result = await db.query(
      `SELECT
        e.nome as equipe_nome,
        p.codigo as poste_codigo,
        p.endereco as poste_endereco,
        p.rua as poste_rua,
        p.numero as poste_numero,
        p.bairro as poste_bairro,
        os.id as ordem_servico_id,
        os.data_abertura,
        os.data_execucao,
        os.data_encerramento,
        os.status as os_status,
        os.resultado as os_resultado
      FROM ordens_servico os
      JOIN equipes e ON os.equipe_id = e.id
      LEFT JOIN solicitacoes s ON os.solicitacao_id = s.id
      LEFT JOIN postes p ON s.poste_id = p.id
      ${whereClause}
      ORDER BY os.data_encerramento DESC NULLS LAST, os.data_abertura DESC`,
      values
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao listar postes reparados:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Listar todas as ordens de servico
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT os.*, s.protocolo, s.tipo_problema, s.endereco_informado,
        e.nome as equipe_nome
      FROM ordens_servico os
      JOIN solicitacoes s ON os.solicitacao_id = s.id
      LEFT JOIN equipes e ON os.equipe_id = e.id
      ORDER BY os.criado_em DESC`
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao listar ordens:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Buscar ordem por ID
router.get('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id)
  try {
    const result = await db.query(
      `SELECT os.*, s.protocolo, s.tipo_problema, s.endereco_informado,
        s.nome_solicitante, s.telefone, s.email,
        s.latitude as solicitacao_latitude, s.longitude as solicitacao_longitude,
        s.codigo_poste_informado, s.poste_id,
        p.codigo as poste_codigo, p.endereco as poste_endereco,
        p.rua as poste_rua, p.numero as poste_numero, p.bairro as poste_bairro,
        p.complemento as poste_complemento,
        e.nome as equipe_nome
      FROM ordens_servico os
      JOIN solicitacoes s ON os.solicitacao_id = s.id
      LEFT JOIN postes p ON s.poste_id = p.id
      LEFT JOIN equipes e ON os.equipe_id = e.id
      WHERE os.id = $1`,
      [id]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Ordem de servico nao encontrada' })
      return
    }
    res.json(result.rows[0])
  } catch (error) {
    console.error('Erro ao buscar ordem:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Buscar detalhes da ordem com historico e anexos
router.get('/:id/detalhe', async (req: Request, res: Response) => {
  const id = String(req.params.id)
  try {
    const ordemResult = await db.query(
      `SELECT os.*, s.protocolo, s.tipo_problema, s.endereco_informado,
        s.nome_solicitante, s.telefone, s.email, s.descricao as solicitacao_descricao,
        s.codigo_poste_informado, s.poste_id, s.prioridade,
        s.latitude as solicitacao_latitude, s.longitude as solicitacao_longitude,
        p.codigo as poste_codigo, p.endereco as poste_endereco,
        p.rua as poste_rua, p.numero as poste_numero, p.bairro as poste_bairro,
        p.complemento as poste_complemento, p.latitude as poste_latitude, p.longitude as poste_longitude,
        e.nome as equipe_nome
      FROM ordens_servico os
      JOIN solicitacoes s ON os.solicitacao_id = s.id
      LEFT JOIN postes p ON s.poste_id = p.id
      LEFT JOIN equipes e ON os.equipe_id = e.id
      WHERE os.id = $1`,
      [id]
    )

    if (ordemResult.rows.length === 0) {
      res.status(404).json({ error: 'Ordem de servico nao encontrada' })
      return
    }

    const historicoResult = await db.query(
      `SELECT sl.*, au.username as criado_por_username
      FROM status_logs sl
      LEFT JOIN admin_users au ON sl.criado_por = au.username
      WHERE sl.solicitacao_id = $1
      ORDER BY sl.criado_em ASC`,
      [ordemResult.rows[0].solicitacao_id]
    )

    const anexosResult = await db.query(
      `SELECT * FROM anexos
      WHERE ordem_servico_id = $1 OR solicitacao_id = $2
      ORDER BY criado_em ASC`,
      [id, ordemResult.rows[0].solicitacao_id]
    )

    res.json({
      ordem: ordemResult.rows[0],
      historico: historicoResult.rows,
      anexos: anexosResult.rows,
    })
  } catch (error) {
    console.error('Erro ao buscar detalhes da ordem:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Criar nova ordem de servico
router.post('/', authMiddleware, requireRole(['admin', 'gestor', 'operador']), async (req: Request, res: Response) => {
  const { solicitacao_id, equipe_id } = req.body

  if (!solicitacao_id) {
    res.status(400).json({ error: 'ID da solicitacao e obrigatorio' })
    return
  }

  if (!equipe_id) {
    res.status(400).json({ error: 'Equipe responsavel e obrigatoria' })
    return
  }

  try {
    const solicitacao = await db.query(
      'SELECT id, status_atual, email, protocolo FROM solicitacoes WHERE id = $1',
      [solicitacao_id]
    )

    if (solicitacao.rows.length === 0) {
      res.status(404).json({ error: 'Solicitacao nao encontrada' })
      return
    }

    const equipe = await db.query(
      'SELECT id FROM equipes WHERE id = $1 AND ativo = true',
      [equipe_id]
    )

    if (equipe.rows.length === 0) {
      res.status(404).json({ error: 'Equipe nao encontrada ou inativa' })
      return
    }

    const ordemExistente = await db.query(
      'SELECT id FROM ordens_servico WHERE solicitacao_id = $1 LIMIT 1',
      [solicitacao_id]
    )

    if (ordemExistente.rows.length > 0) {
      res.status(409).json({
        error: 'Solicitacao ja possui ordem de servico',
        ordem_servico_id: ordemExistente.rows[0].id,
      })
      return
    }

    const result = await db.query(
      `INSERT INTO ordens_servico (solicitacao_id, equipe_id)
      VALUES ($1, $2)
      RETURNING *`,
      [solicitacao_id, equipe_id]
    )

    await db.query(
      'UPDATE solicitacoes SET status_atual = $1 WHERE id = $2',
      ['em_execucao', solicitacao_id]
    )

    await db.query(
      'INSERT INTO status_logs (solicitacao_id, status_anterior, status_novo, criado_por) VALUES ($1, $2, $3, $4)',
      [solicitacao_id, solicitacao.rows[0].status_atual, 'em_execucao', 'operador']
    )

    notificarStatusSolicitacao({
      email: solicitacao.rows[0].email,
      protocolo: solicitacao.rows[0].protocolo,
      statusNovo: 'em_execucao',
    }).catch((err) => console.error('Falha ao enviar notificacao:', err))

    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Erro ao criar ordem:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Excluir ordem de servico
router.delete('/:id', authMiddleware, requireRole(['admin', 'gestor']), async (req: Request, res: Response) => {
  const id = String(req.params.id)
  try {
    const result = await db.query(
      `SELECT os.*, s.protocolo FROM ordens_servico os
       JOIN solicitacoes s ON os.solicitacao_id = s.id
       WHERE os.id = $1`,
      [id]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Ordem de servico nao encontrada' })
      return
    }

    const ordem = result.rows[0]
    const statusFechados = ['concluida', 'cancelada', 'em_manutencao']

    if (statusFechados.includes(ordem.status)) {
      res.status(409).json({
        error: 'Ordem de servico encerrada nao pode ser excluida',
        status: ordem.status,
      })
      return
    }

    const temAnexos = await db.query(
      'SELECT id FROM anexos WHERE ordem_servico_id = $1 LIMIT 1',
      [id]
    )
    if (temAnexos.rows.length > 0) {
      res.status(409).json({
        error: 'Ordem de servico possui anexos e nao pode ser excluida',
      })
      return
    }

    await db.query(
      'UPDATE solicitacoes SET status_atual = $1 WHERE id = $2',
      ['aberta', ordem.solicitacao_id]
    )

    await db.query('DELETE FROM ordens_servico WHERE id = $1', [id])

    res.json({ message: 'Ordem de servico excluida' })
  } catch (error) {
    console.error('Erro ao excluir ordem:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Atualizar status da ordem
router.patch('/:id/status', authMiddleware, requireRole(['admin', 'gestor', 'operador']), async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const { status, observacao_execucao, resultado, material_utilizado } = req.body

  const statusValidos = ['aberta', 'em_execucao', 'concluida', 'em_manutencao', 'cancelada']

  if (!statusValidos.includes(status)) {
    res.status(400).json({ error: 'Status invalido' })
    return
  }

  try {
    const current = await db.query(
      `SELECT os.*, s.protocolo, s.email
       FROM ordens_servico os
       JOIN solicitacoes s ON os.solicitacao_id = s.id
       WHERE os.id = $1`,
      [id]
    )

    if (current.rows.length === 0) {
      res.status(404).json({ error: 'Ordem de servico nao encontrada' })
      return
    }

    const statusAnterior = current.rows[0].status

    const statusFechados = ['concluida', 'cancelada', 'em_manutencao']
    if (statusFechados.includes(statusAnterior)) {
      res.status(409).json({
        error: 'Ordem de servico encerrada nao pode ser alterada',
        status: statusAnterior,
      })
      return
    }

    if (status === 'em_execucao') {
      await db.query(
        'UPDATE ordens_servico SET status = $1, data_execucao = NOW() WHERE id = $2',
        [status, id]
      )
      await db.query(
        'INSERT INTO status_logs (solicitacao_id, status_anterior, status_novo, observacao, criado_por) VALUES ($1, $2, $3, $4, $5)',
        [current.rows[0].solicitacao_id, statusAnterior, 'em_execucao', 'Ordem em execucao', 'equipe']
      )
    } else if (status === 'concluida') {
      await db.query(
        `UPDATE ordens_servico SET
          status = $1,
          data_encerramento = NOW(),
          observacao_execucao = $2,
          resultado = $3,
          material_utilizado = $4
        WHERE id = $5`,
        [status, observacao_execucao || null, resultado || null, material_utilizado || null, id]
      )
      await db.query(
        'UPDATE solicitacoes SET status_atual = $1 WHERE id = $2',
        ['concluida', current.rows[0].solicitacao_id]
      )
      await db.query(
        'INSERT INTO status_logs (solicitacao_id, status_anterior, status_novo, observacao, criado_por) VALUES ($1, $2, $3, $4, $5)',
        [current.rows[0].solicitacao_id, statusAnterior, 'concluida', observacao_execucao || 'Ordem concluida', 'equipe']
      )

      notificarStatusSolicitacao({
        email: current.rows[0].email,
        protocolo: current.rows[0].protocolo,
        statusNovo: 'concluida',
        observacao: observacao_execucao,
      }).catch((err) => console.error('Falha ao enviar notificacao:', err))
    } else if (status === 'em_manutencao') {
      await db.query(
        `UPDATE ordens_servico SET
          status = $1,
          observacao_execucao = $2,
          resultado = $3,
          material_utilizado = $4
        WHERE id = $5`,
        [status, observacao_execucao || null, resultado || null, material_utilizado || null, id]
      )
      await db.query(
        'UPDATE solicitacoes SET status_atual = $1 WHERE id = $2',
        ['em_manutencao', current.rows[0].solicitacao_id]
      )
      await db.query(
        'INSERT INTO status_logs (solicitacao_id, status_anterior, status_novo, observacao, criado_por) VALUES ($1, $2, $3, $4, $5)',
        [current.rows[0].solicitacao_id, statusAnterior, 'em_manutencao', observacao_execucao || 'Ordem em manutencao', 'equipe']
      )
    } else if (status === 'cancelada') {
      await db.query(
        `UPDATE ordens_servico SET
          status = $1,
          data_encerramento = NOW(),
          observacao_execucao = $2,
          material_utilizado = $3
        WHERE id = $4`,
        [status, observacao_execucao || null, material_utilizado || null, id]
      )
      await db.query(
        'UPDATE solicitacoes SET status_atual = $1 WHERE id = $2',
        ['nao_procedente', current.rows[0].solicitacao_id]
      )
      await db.query(
        'INSERT INTO status_logs (solicitacao_id, status_anterior, status_novo, observacao, criado_por) VALUES ($1, $2, $3, $4, $5)',
        [current.rows[0].solicitacao_id, statusAnterior, 'nao_procedente', observacao_execucao || 'Ordem cancelada', 'equipe']
      )
    } else {
      await db.query(
        'UPDATE ordens_servico SET status = $1 WHERE id = $2',
        [status, id]
      )
    }

    res.json({ message: 'Status da ordem atualizado' })
  } catch (error) {
    console.error('Erro ao atualizar ordem:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
