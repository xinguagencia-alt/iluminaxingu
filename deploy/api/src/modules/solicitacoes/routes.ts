import { Router, Request, Response } from 'express'
import { db } from '../../db.js'
import rateLimit from 'express-rate-limit'
import { authMiddleware, requireRole } from '../auth/middleware.js'
import { notificarStatusSolicitacao, notificarNovaSolicitacao } from '../notificacoes/notificacoes.js'
import { calcularPrioridadeAutomatica } from './prioridade.js'
import { injectSla } from './sla.js'
import {
  normalizarTelefone,
  montarMensagemProtocolo,
  montarMensagemStatus,
  montarMensagemConclusao,
  montarWhatsAppUrl,
} from './whatsapp.js'

const router = Router()

const publicSolicitacaoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas solicitacoes enviadas. Tente novamente em 15 minutos.' },
})

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
    res.json(result.rows.map((row) => injectSla(row)))
  } catch (error) {
    console.error('Erro ao listar solicitacoes:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.get('/protocolo/:protocolo', authMiddleware, async (req: Request, res: Response) => {
  const { protocolo } = req.params
  try {
    const result = await db.query('SELECT * FROM solicitacoes WHERE protocolo = $1', [protocolo])
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Solicitacao nao encontrada' })
      return
    }
    res.json(injectSla(result.rows[0]))
  } catch (error) {
    console.error('Erro ao buscar solicitacao:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

const publicGetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas consultas. Tente novamente em 15 minutos.' },
})

router.get('/publica/:protocolo', publicGetLimiter, async (req: Request, res: Response) => {
  const { protocolo } = req.params
  try {
    const solResult = await db.query(
      `SELECT s.id, s.protocolo, s.codigo_poste_informado, s.tipo_problema,
        s.status_atual, s.prioridade, s.criado_em, s.atualizado_em,
        os.id as ordem_servico_id, os.status as os_status,
        os.data_abertura as os_data_abertura,
        os.data_encerramento as os_data_encerramento
      FROM solicitacoes s
      LEFT JOIN ordens_servico os ON os.solicitacao_id = s.id
      WHERE s.protocolo = $1`,
      [protocolo]
    )

    if (solResult.rows.length === 0) {
      res.status(404).json({ error: 'Solicitacao nao encontrada' })
      return
    }

    const solicitacao = solResult.rows[0]

    const histResult = await db.query(
      `SELECT sl.id, sl.status_anterior, sl.status_novo, sl.criado_em
      FROM status_logs sl
      WHERE sl.solicitacao_id = $1
      ORDER BY sl.criado_em ASC`,
      [solicitacao.id]
    )

    res.json({
      solicitacao: injectSla(solicitacao),
      historico: histResult.rows,
    })
  } catch (error) {
    console.error('Erro na consulta publica:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const result = await db.query('SELECT * FROM solicitacoes WHERE id = $1', [id])
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Solicitacao nao encontrada' })
      return
    }
    res.json(injectSla(result.rows[0]))
  } catch (error) {
    console.error('Erro ao buscar solicitacao:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.get('/:id/mensagem-whatsapp', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params
  const tipo = (req.query.tipo as string) || 'status'

  const tiposAceitos = ['protocolo', 'status', 'concluida']
  if (!tiposAceitos.includes(tipo)) {
    res.status(400).json({ error: 'Tipo invalido. Use: protocolo, status ou concluida' })
    return
  }

  try {
    const result = await db.query(
      'SELECT id, protocolo, nome_solicitante, telefone, status_atual FROM solicitacoes WHERE id = $1',
      [id]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Solicitacao nao encontrada' })
      return
    }

    const sol = result.rows[0]
    const telefoneNormalizado = normalizarTelefone(sol.telefone || '')

    let mensagem: string
    if (tipo === 'protocolo') {
      mensagem = montarMensagemProtocolo(sol.nome_solicitante, sol.protocolo)
    } else if (tipo === 'concluida') {
      mensagem = montarMensagemConclusao(sol.nome_solicitante, sol.protocolo)
    } else {
      mensagem = montarMensagemStatus(sol.nome_solicitante, sol.protocolo, sol.status_atual)
    }

    const whatsappUrl = telefoneNormalizado
      ? montarWhatsAppUrl(telefoneNormalizado, mensagem)
      : null

    res.json({
      mensagem,
      telefone_normalizado: telefoneNormalizado,
      whatsapp_url: whatsappUrl,
    })
  } catch (error) {
    console.error('Erro ao gerar mensagem WhatsApp:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.post('/', publicSolicitacaoLimiter, async (req: Request, res: Response) => {
  const {
    nome_solicitante,
    telefone,
    email,
    poste_id: poste_id_body,
    codigo_poste,
    endereco_informado,
    latitude,
    longitude,
    tipo_problema,
    descricao,
    consentimento_lgpd,
  } = req.body

  if (!nome_solicitante || !tipo_problema) {
    res.status(400).json({ error: 'Nome e tipo de problema sao obrigatorios' })
    return
  }

  if (!telefone || !String(telefone).trim()) {
    res.status(400).json({
      error: 'Informe um telefone para receber o protocolo e o retorno',
    })
    return
  }

  if (!consentimento_lgpd) {
    res.status(400).json({
      error: 'O consentimento com a LGPD e obrigatorio para enviar a solicitacao',
    })
    return
  }

  try {
    const now = new Date()
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase()
    const protocolo = `ILX${datePart}-${randomPart}`

    let poste_id: number | null = null
    let codigo_poste_final: string | null = codigo_poste || null
    let auto_identificado = false

    if (poste_id_body != null) {
      const posteIdNumerico = Number(poste_id_body)
      if (!isNaN(posteIdNumerico)) {
        const posteManual = await db.query(
          'SELECT id, codigo FROM postes WHERE id = $1 AND status_ativo = TRUE',
          [posteIdNumerico]
        )
        if (posteManual.rows.length > 0) {
          poste_id = posteManual.rows[0].id
          codigo_poste_final = posteManual.rows[0].codigo
        }
      }
    }

    if (!poste_id && codigo_poste) {
      const posteResult = await db.query(
        'SELECT id, codigo FROM postes WHERE codigo = $1 AND status_ativo = TRUE',
        [codigo_poste]
      )
      if (posteResult.rows.length > 0) {
        poste_id = posteResult.rows[0].id
        codigo_poste_final = posteResult.rows[0].codigo
      }
    }

    if (!poste_id && latitude != null && longitude != null) {
      const lat = Number(latitude)
      const lng = Number(longitude)

      if (!isNaN(lat) && !isNaN(lng)) {
        const postesProximos = await db.query(
          `WITH postes_com_distancia AS (
            SELECT
              id,
              codigo,
              (
                6371000 * acos(
                  cos(radians($1)) * cos(radians(latitude)) *
                  cos(radians(longitude) - radians($2)) +
                  sin(radians($1)) * sin(radians(latitude))
                )
              ) AS distancia_metros
            FROM postes
            WHERE status_ativo = TRUE
              AND latitude IS NOT NULL
              AND longitude IS NOT NULL
          )
          SELECT id, codigo, distancia_metros
          FROM postes_com_distancia
          WHERE distancia_metros <= 8
          ORDER BY distancia_metros
          LIMIT 2`,
          [lat, lng]
        )

        if (postesProximos.rows.length === 1) {
          poste_id = postesProximos.rows[0].id
          codigo_poste_final = postesProximos.rows[0].codigo
          auto_identificado = true
        }
      }
    }

    const prioridade = await calcularPrioridadeAutomatica(tipo_problema, poste_id, codigo_poste_final)

    const result = await db.query(
      `INSERT INTO solicitacoes (
        protocolo, nome_solicitante, telefone, email,
        poste_id, codigo_poste_informado, endereco_informado, latitude, longitude,
        tipo_problema, descricao, prioridade, consentimento_lgpd, auto_identificado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        protocolo,
        nome_solicitante,
        telefone,
        email || null,
        poste_id,
        codigo_poste_final,
        endereco_informado || null,
        latitude != null ? Number(latitude) : null,
        longitude != null ? Number(longitude) : null,
        tipo_problema,
        descricao || null,
        prioridade,
        Boolean(consentimento_lgpd),
        auto_identificado,
      ]
    )

    await db.query(
      'INSERT INTO status_logs (solicitacao_id, status_novo, criado_por) VALUES ($1, $2, $3)',
      [result.rows[0].id, 'enviada', 'sistema']
    )

    notificarNovaSolicitacao({
      protocolo,
      nomeSolicitante: nome_solicitante,
      tipoProblema: tipo_problema,
      descricao,
      endereco: endereco_informado,
    }).catch((err) => console.error('Falha ao enviar notificacao para admin:', err))

    res.status(201).json({
      ...injectSla(result.rows[0]),
      auto_identificado,
    })
  } catch (error) {
    console.error('Erro ao criar solicitacao:', error)
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[SOLICITACAO] Detalhe:', detail)
    res.status(500).json({ error: 'Erro interno do servidor', detail: process.env.NODE_ENV === 'production' ? undefined : detail })
  }
})

router.patch('/:id/status', authMiddleware, requireRole(['admin', 'gestor', 'operador']), async (req: Request, res: Response) => {
  const { id } = req.params
  const { status, observacao } = req.body
  const criado_por = req.user?.username || 'sistema'

  const statusValidos = [
    'enviada',
    'em_analise',
    'em_execucao',
    'em_manutencao',
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
    const current = await db.query(
      'SELECT status_atual, email, protocolo FROM solicitacoes WHERE id = $1',
      [id]
    )

    if (current.rows.length === 0) {
      res.status(404).json({ error: 'Solicitacao nao encontrada' })
      return
    }

    const { status_atual: statusAnterior, email, protocolo } = current.rows[0]

    const statusFechados = ['concluida', 'cancelada', 'nao_procedente', 'duplicada']
    if (statusFechados.includes(statusAnterior)) {
      res.status(409).json({
        error: 'Solicitacao encerrada nao pode ser alterada',
        status: statusAnterior,
      })
      return
    }

    await db.query('UPDATE solicitacoes SET status_atual = $1 WHERE id = $2', [status, id])

    await db.query(
      'INSERT INTO status_logs (solicitacao_id, status_anterior, status_novo, observacao, criado_por) VALUES ($1, $2, $3, $4, $5)',
      [id, statusAnterior, status, observacao || null, criado_por || 'sistema']
    )

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

router.get('/:id/historico', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const result = await db.query('SELECT * FROM status_logs WHERE solicitacao_id = $1 ORDER BY criado_em ASC', [id])
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao buscar historico:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router



