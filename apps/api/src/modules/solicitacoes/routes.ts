import { Router, Request, Response } from 'express'
import { db } from '../../db'
import { authMiddleware } from '../auth/middleware'
import { notificarStatusSolicitacao } from '../notificacoes/notificacoes'

const router = Router()

// Listar solicitacoes com filtros (requer autenticacao)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const { status, prioridade, busca } = req.query

  const conditions: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (status && typeof status === 'string') {
    conditions.push(`s.status_atual = $${paramIndex}`)
    values.push(status)
    paramIndex++
  }

  if (prioridade && typeof prioridade === 'string') {
    conditions.push(`s.prioridade = $${paramIndex}`)
    values.push(prioridade)
    paramIndex++
  }

  if (busca && typeof busca === 'string') {
    conditions.push(`(s.protocolo ILIKE $${paramIndex} OR s.nome_solicitante ILIKE $${paramIndex})`)
    values.push(`%${busca}%`)
    paramIndex++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  try {
    const result = await db.query(
      `SELECT s.*, os.id as ordem_servico_id
       FROM solicitacoes s
       LEFT JOIN ordens_servico os ON os.solicitacao_id = s.id
       ${whereClause}
       ORDER BY s.criado_em DESC`,
      values
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao listar solicitacoes:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Buscar solicitacao por protocolo
router.get('/protocolo/:protocolo', async (req: Request, res: Response) => {
  const { protocolo } = req.params
  try {
    const result = await db.query(
      'SELECT * FROM solicitacoes WHERE protocolo = $1',
      [protocolo]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Solicitacao nao encontrada' })
      return
    }
    res.json(result.rows[0])
  } catch (error) {
    console.error('Erro ao buscar solicitacao:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Consulta publica por protocolo (dados completos sem auth)
router.get('/publica/:protocolo', async (req: Request, res: Response) => {
  const { protocolo } = req.params
  try {
    const solResult = await db.query(
      `SELECT s.*, os.id as ordem_servico_id, os.status as os_status,
        os.equipe_id, os.data_abertura as os_data_abertura,
        os.data_encerramento as os_data_encerramento,
        os.observacao_execucao as os_observacao, os.resultado as os_resultado,
        e.nome as equipe_nome
      FROM solicitacoes s
      LEFT JOIN ordens_servico os ON os.solicitacao_id = s.id
      LEFT JOIN equipes e ON os.equipe_id = e.id
      WHERE s.protocolo = $1`,
      [protocolo]
    )

    if (solResult.rows.length === 0) {
      res.status(404).json({ error: 'Solicitacao nao encontrada' })
      return
    }

    const solicitacao = solResult.rows[0]

    const histResult = await db.query(
      `SELECT sl.*, au.username as criado_por_username
      FROM status_logs sl
      LEFT JOIN admin_users au ON sl.criado_por = au.username
      WHERE sl.solicitacao_id = $1
      ORDER BY sl.criado_em ASC`,
      [solicitacao.id]
    )

    const anexosResult = await db.query(
      `SELECT id, arquivo_nome, arquivo_tipo, tamanho_bytes, criado_em FROM anexos
      WHERE solicitacao_id = $1 OR ordem_servico_id = $2
      ORDER BY criado_em ASC`,
      [solicitacao.id, solicitacao.ordem_servico_id]
    )

    res.json({
      solicitacao,
      historico: histResult.rows,
      anexos: anexosResult.rows,
    })
  } catch (error) {
    console.error('Erro na consulta publica:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Buscar solicitacao por ID
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const result = await db.query('SELECT * FROM solicitacoes WHERE id = $1', [
      id,
    ])
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Solicitacao nao encontrada' })
      return
    }
    res.json(result.rows[0])
  } catch (error) {
    console.error('Erro ao buscar solicitacao:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Criar nova solicitacao
router.post('/', async (req: Request, res: Response) => {
  const {
    nome_solicitante,
    telefone,
    email,
    codigo_poste,
    endereco_informado,
    latitude,
    longitude,
    tipo_problema,
    descricao,
  } = req.body

  if (!nome_solicitante || !tipo_problema) {
    res.status(400).json({ error: 'Nome e tipo de problema sao obrigatorios' })
    return
  }

  if (!telefone && !email) {
    res.status(400).json({
      error: 'Informe pelo menos um contato (telefone ou email)',
    })
    return
  }

  try {
    // Gerar protocolo unico
    const now = new Date()
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase()
    const protocolo = `ILX${datePart}-${randomPart}`

    // Buscar poste pelo codigo se informado
    let poste_id = null
    if (codigo_poste) {
      const posteResult = await db.query(
        'SELECT id FROM postes WHERE codigo = $1',
        [codigo_poste]
      )
      if (posteResult.rows.length > 0) {
        poste_id = posteResult.rows[0].id
      }
    }

    // Construir query de insercao
    const query = `
      INSERT INTO solicitacoes (
        protocolo, nome_solicitante, telefone, email,
        poste_id, codigo_poste_informado, endereco_informado, latitude, longitude,
        geom, tipo_problema, descricao
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
        CASE WHEN $8 IS NOT NULL AND $9 IS NOT NULL
          THEN ST_SetSRID(ST_MakePoint($9, $8), 4326)
          ELSE NULL
        END,
        $10, $11)
      RETURNING *
    `

    const values = [
      protocolo,
      nome_solicitante,
      telefone || null,
      email || null,
      poste_id,
      codigo_poste || null,
      endereco_informado || null,
      latitude || null,
      longitude || null,
      tipo_problema,
      descricao || null,
    ]

    const result = await db.query(query, values)

    // Registrar log de status
    await db.query(
      'INSERT INTO status_logs (solicitacao_id, status_novo, criado_por) VALUES ($1, $2, $3)',
      [result.rows[0].id, 'enviada', 'sistema']
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Erro ao criar solicitacao:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Atualizar status da solicitacao (requer autenticacao)
router.patch('/:id/status', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params
  const { status, observacao } = req.body
  const criado_por = req.user?.username || 'sistema'

  const statusValidos = [
    'enviada',
    'em_analise',
    'em_execucao',
    'concluida',
    'nao_procedente',
    'cancelada',
    'duplicada',
  ]

  if (!statusValidos.includes(status)) {
    res.status(400).json({ error: 'Status invalido' })
    return
  }

  try {
    // Buscar status atual e email
    const current = await db.query(
      'SELECT status_atual, email, protocolo FROM solicitacoes WHERE id = $1',
      [id]
    )

    if (current.rows.length === 0) {
      res.status(404).json({ error: 'Solicitacao nao encontrada' })
      return
    }

    const { status_atual: statusAnterior, email, protocolo } = current.rows[0]

    // Atualizar solicitacao
    await db.query('UPDATE solicitacoes SET status_atual = $1 WHERE id = $2', [
      status,
      id,
    ])

    // Registrar log
    await db.query(
      'INSERT INTO status_logs (solicitacao_id, status_anterior, status_novo, observacao, criado_por) VALUES ($1, $2, $3, $4, $5)',
      [id, statusAnterior, status, observacao || null, criado_por || 'sistema']
    )

    // Enviar notificacao por e-mail (nao bloqueia resposta)
    notificarStatusSolicitacao({
      email,
      protocolo,
      statusNovo: status,
      observacao,
    }).catch((err) => console.error('Falha ao enviar notificacao:', err))

    res.json({ message: 'Status atualizado', status_anterior: statusAnterior })
  } catch (error) {
    console.error('Erro ao atualizar status:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Buscar historico de status
router.get('/:id/historico', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const result = await db.query(
      'SELECT * FROM status_logs WHERE solicitacao_id = $1 ORDER BY criado_em ASC',
      [id]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao buscar historico:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
