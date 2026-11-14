import { Router, Request, Response } from 'express'
import { db } from '../../db.js'
import rateLimit from 'express-rate-limit'
import { authMiddleware, requireRole } from '../auth/middleware.js'
import { notificarStatusSolicitacao, notificarNovaSolicitacao } from '../notificacoes/notificacoes.js'
import {
  buscarSolicitacaoDuplicada,
  comLockLocalizacao,
  montarChaveLocalizacao,
} from './duplicidade.js'
import {
  decidirElegibilidadeAutomatica,
  lerModoOperacional,
} from '../fluxo/routes.js'
import {
  criarOsAutomatica,
  registrarFalhaOsAutomatica,
} from '../ordens_servico/automatica.js'
import { distribuirOs } from '../ordens_servico/distribuicao.js'
import { calcularPrioridadeAutomatica } from './prioridade.js'
import { injectSla } from './sla.js'
import {
  labelTipoProblema,
  normalizarTipoProblema,
  tiposProblemaQueContem,
} from './tipos.js'
import {
  ERRO_POSTE_NAO_ENCONTRADO,
  primeiraMensagemDeErro,
  validarSolicitacao,
} from './validacao.js'
import {
  registrarConfirmacao,
  type ConfirmacaoPublica,
  type EntradaConfirmacao,
} from './confirmacoes.js'
import { montarRespostaPublica } from './publico.js'
import {
  normalizarTelefone,
  montarMensagemProtocolo,
  montarMensagemStatus,
  montarMensagemConclusao,
  montarWhatsAppUrl,
} from './whatsapp.js'

const router = Router()

function limiteSolicitacoesPublicas(): number {
  const configurado = Number(process.env.RATE_LIMIT_SOLICITACAO_MAX)
  if (Number.isFinite(configurado) && configurado > 0) return configurado
  return 8
}

async function confirmarNoPortal(entrada: EntradaConfirmacao): Promise<ConfirmacaoPublica | null> {
  try {
    return await registrarConfirmacao(entrada)
  } catch (erro) {
    console.error('[CONFIRMACAO] Falha ao registrar confirmacao:', erro)
    return null
  }
}

export function ehErroDeConsultaGpsNaoSuportada(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : String(erro)
  return (
    /function\s+.*\)\s+does not exist/i.test(mensagem) ||
    /operator\s+does not exist/i.test(mensagem) ||
    /not supported|unsupported/i.test(mensagem)
  )
}

const publicSolicitacaoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: limiteSolicitacoesPublicas(),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas solicitacoes enviadas. Tente novamente em 15 minutos.' },
})

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const { status, prioridade, tipo, busca } = req.query

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

  if (tipo && typeof tipo === 'string') {
    conditions.push(`s.tipo_problema = $${paramIndex}`)
    values.push(normalizarTipoProblema(tipo))
    paramIndex++
  }

  if (busca && typeof busca === 'string') {
    const tiposEncontrados = tiposProblemaQueContem(busca)
    if (tiposEncontrados.length > 0) {
      conditions.push(
        `(s.protocolo ILIKE $${paramIndex} OR s.nome_solicitante ILIKE $${paramIndex} OR s.tipo_problema = ANY($${paramIndex + 1}::text[]))`
      )
      values.push(`%${busca}%`, tiposEncontrados)
      paramIndex += 2
    } else {
      conditions.push(`(s.protocolo ILIKE $${paramIndex} OR s.nome_solicitante ILIKE $${paramIndex})`)
      values.push(`%${busca}%`)
      paramIndex++
    }
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
  const body: Record<string, unknown> =
    req.body && typeof req.body === 'object'
      ? (req.body as Record<string, unknown>)
      : {}

  const validacao = validarSolicitacao(body)
  if (!validacao.ok) {
    res.status(400).json({
      error: primeiraMensagemDeErro(validacao.erros),
      erros: validacao.erros,
    })
    return
  }

  const valores = validacao.valores
  const nome_solicitante = valores.nome_solicitante
  const telefone = valores.telefone
  const email = valores.email
  const tipo_problema = valores.tipo_problema
  const descricao = valores.descricao
  const client_request_id = body.client_request_id

  let clientRequestId: string | null = null
  if (client_request_id !== undefined && client_request_id !== null && client_request_id !== '') {
    if (typeof client_request_id !== 'string') {
      res.status(400).json({ error: 'client_request_id invalido' })
      return
    }
    const clientRequestIdTrimmed = client_request_id.trim()
    if (clientRequestIdTrimmed.length < 8 || clientRequestIdTrimmed.length > 64) {
      res.status(400).json({ error: 'client_request_id deve ter entre 8 e 64 caracteres' })
      return
    }
    clientRequestId = clientRequestIdTrimmed
  }

  try {
    if (clientRequestId) {
      const existente = await db.query(
        'SELECT * FROM solicitacoes WHERE client_request_id = $1',
        [clientRequestId]
      )
      if (existente.rows.length > 0) {
        const modoReplay = await lerModoOperacional()
        res.status(200).json(
          await montarRespostaPublica(existente.rows[0] as Record<string, unknown>, {
            duplicada: false,
            fluxo: modoReplay,
            confirmacao: null,
            elegivelOsAutomatica: false,
          })
        )
        return
      }
    }

    const now = new Date()
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase()
    const protocolo = `ILX${datePart}-${randomPart}`

    let poste_id: number | null = null
    let codigo_poste_final: string | null = valores.codigo_poste
    let auto_identificado = false

    if (valores.poste_id != null) {
      const posteManual = await db.query(
        'SELECT id, codigo FROM postes WHERE id = $1 AND status_ativo = TRUE',
        [valores.poste_id]
      )
      if (posteManual.rows.length === 0) {
        res.status(400).json({ error: ERRO_POSTE_NAO_ENCONTRADO })
        return
      }
      poste_id = posteManual.rows[0].id
      codigo_poste_final = posteManual.rows[0].codigo
    } else if (codigo_poste_final) {
      const posteResult = await db.query(
        'SELECT id, codigo FROM postes WHERE codigo = $1 AND status_ativo = TRUE',
        [codigo_poste_final]
      )
      if (posteResult.rows.length === 0) {
        res.status(400).json({ error: ERRO_POSTE_NAO_ENCONTRADO })
        return
      }
      poste_id = posteResult.rows[0].id
      codigo_poste_final = posteResult.rows[0].codigo
    } else if (valores.latitude != null && valores.longitude != null) {
      try {
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
          [valores.latitude, valores.longitude]
        )

        if (postesProximos.rows.length === 1) {
          poste_id = postesProximos.rows[0].id
          codigo_poste_final = postesProximos.rows[0].codigo
          auto_identificado = true
        }
      } catch (gpsError) {
        if (ehErroDeConsultaGpsNaoSuportada(gpsError)) {
          console.warn(
            `[SOLICITACAO] Funcao geografica indisponivel neste banco; seguindo sem auto-identificacao (lat=${valores.latitude}, lng=${valores.longitude}): ${
              gpsError instanceof Error ? gpsError.message : String(gpsError)
            }`
          )
        } else {
          throw gpsError
        }
      }
    }

    const chaveLocal = montarChaveLocalizacao({
      poste_id,
      codigo_poste: codigo_poste_final,
      latitude: valores.latitude,
      longitude: valores.longitude,
      endereco: valores.endereco_informado,
    })

    const lockKey = `${chaveLocal ?? 'sem-local'}|${tipo_problema}`
    const resultadoCriacao = await comLockLocalizacao(lockKey, async () => {
      const existente = await buscarSolicitacaoDuplicada(chaveLocal, tipo_problema)
      if (existente) {
        return { tipo: 'duplicada' as const, solicitacao: existente }
      }

      const prioridade = await calcularPrioridadeAutomatica(
        tipo_problema,
        poste_id,
        codigo_poste_final
      )

      const colunas = [
        'protocolo',
        'nome_solicitante',
        'telefone',
        'email',
        'poste_id',
        'codigo_poste_informado',
        'endereco_informado',
        'latitude',
        'longitude',
        'tipo_problema',
        'descricao',
        'prioridade',
        'consentimento_lgpd',
        'auto_identificado',
      ]
      const parametros: unknown[] = [
        protocolo,
        nome_solicitante,
        telefone,
        email,
        poste_id,
        codigo_poste_final,
        valores.endereco_informado,
        valores.latitude,
        valores.longitude,
        tipo_problema,
        descricao,
        prioridade,
        true,
        auto_identificado,
      ]

      if (clientRequestId) {
        colunas.push('client_request_id')
        parametros.push(clientRequestId)
      }

      const result = await db.query(
        `INSERT INTO solicitacoes (${colunas.join(', ')})
         VALUES (${parametros.map((_, index) => `$${index + 1}`).join(', ')})
         RETURNING *`,
        parametros
      )

      await db.query(
        'INSERT INTO status_logs (solicitacao_id, status_novo, criado_por) VALUES ($1, $2, $3)',
        [result.rows[0].id, 'enviada', 'sistema']
      )

      return { tipo: 'criada' as const, solicitacao: result.rows[0] as Record<string, unknown> }
    })

    const modoOperacional = await lerModoOperacional()

    if (resultadoCriacao.tipo === 'duplicada') {
      const solicitacaoId = Number(resultadoCriacao.solicitacao.id)
      const confirmacao = await confirmarNoPortal({
        solicitacaoId,
        telefoneInformado: telefone,
        origem: clientRequestId ? 'offline' : 'portal',
        clientRequestId,
      })

      const atualizada = await db.query(
        'SELECT * FROM solicitacoes WHERE id = $1',
        [solicitacaoId]
      )
      const row =
        (atualizada.rows[0] as Record<string, unknown> | undefined) ??
        resultadoCriacao.solicitacao

      res.status(200).json(
        await montarRespostaPublica(row, {
          duplicada: true,
          fluxo: modoOperacional,
          confirmacao,
          elegivelOsAutomatica: decidirElegibilidadeAutomatica({
            modo: modoOperacional,
            duplicada: true,
          }),
        })
      )
      return
    }

    const elegivelOs = decidirElegibilidadeAutomatica({
      modo: modoOperacional,
      duplicada: false,
    })

    let osAutomatica: Record<string, unknown> | null = null
    let osAutomaticaErro: string | null = null
    let distribuicao: Record<string, unknown> | null = null

    if (elegivelOs) {
      try {
        const resultadoOs = await criarOsAutomatica(
          Number(resultadoCriacao.solicitacao.id)
        )
        osAutomatica = resultadoOs.ordem

        if (resultadoOs.ordem && resultadoOs.ordem.id != null) {
          try {
            const resultadoDist = await distribuirOs(Number(resultadoOs.ordem.id), {
              origem: 'automatica',
            })
            distribuicao = resultadoDist as unknown as Record<string, unknown>
            if (resultadoDist.atribuida && osAutomatica) {
              osAutomatica = {
                ...osAutomatica,
                equipe_id: resultadoDist.equipe_id,
              }
            }
          } catch (distError) {
            console.error(
              '[DISTRIBUICAO] Falha ao distribuir OS automatica:',
              distError
            )
          }
        }
      } catch (osError) {
        osAutomaticaErro =
          osError instanceof Error ? osError.message : String(osError)
        await registrarFalhaOsAutomatica(
          Number(resultadoCriacao.solicitacao.id),
          osAutomaticaErro
        )
      }
    }

    notificarNovaSolicitacao({
      protocolo,
      nomeSolicitante: nome_solicitante,
      tipoProblema: labelTipoProblema(tipo_problema),
      descricao,
      endereco: valores.endereco_informado,
    }).catch((err) => console.error('Falha ao enviar notificacao para admin:', err))

    res.status(201).json(
      await montarRespostaPublica(resultadoCriacao.solicitacao, {
        duplicada: false,
        fluxo: modoOperacional,
        confirmacao: null,
        incluirDetalhesCriacao: true,
        autoIdentificado: auto_identificado,
        elegivelOsAutomatica: elegivelOs,
        osAutomatica: osAutomatica
          ? {
              id: osAutomatica.id,
              status: osAutomatica.status,
              equipe_id: osAutomatica.equipe_id ?? null,
              origem: 'automatica',
            }
          : null,
        distribuicao,
        osAutomaticaErro,
      })
    )
  } catch (error) {
    const codigoPostgres =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : ''
    const restricao =
      typeof error === 'object' && error !== null && 'constraint' in error
        ? String((error as { constraint?: unknown }).constraint ?? '')
        : ''

    if (clientRequestId && codigoPostgres === '23505' && restricao.includes('client_request_id')) {
      try {
        const existente = await db.query(
          'SELECT * FROM solicitacoes WHERE client_request_id = $1',
          [clientRequestId]
        )
        if (existente.rows.length > 0) {
          const modoRecuperacao = await lerModoOperacional()
          res.status(200).json(
            await montarRespostaPublica(existente.rows[0] as Record<string, unknown>, {
              duplicada: false,
              fluxo: modoRecuperacao,
              confirmacao: null,
              elegivelOsAutomatica: false,
            })
          )
          return
        }
      } catch (lookupError) {
        console.error('Erro ao recuperar solicitacao duplicada:', lookupError)
      }
    }

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



