import { Router, Request, Response } from 'express'
import { db } from '../../db.js'
import { authMiddleware, requireRole } from '../auth/middleware.js'
import { registrarAuditoria } from '../auditoria/helper.js'

const router = Router()

const POSTE_SELECT = `id, codigo, endereco, rua, numero, bairro, complemento, latitude, longitude,
  tipo_luminaria, potencia, data_instalacao, data_ultima_manutencao, status_ativo`
const BAIRRO_NORMALIZADO = `COALESCE(NULLIF(TRIM(bairro), ''), 'Sem bairro informado')`

router.get('/mapa', async (_req: Request, res: Response) => {
  let postes: Record<string, unknown>[] = []
  let bairrosRows: Record<string, unknown>[] = []

  try {
    try {
      const postesResult = await db.query(
        `SELECT id, codigo, endereco, rua, numero, bairro, complemento,
          latitude, longitude, tipo_luminaria, potencia, status_ativo
         FROM postes
         WHERE status_ativo = TRUE
         ORDER BY codigo`
      )
      postes = postesResult.rows.map((p: Record<string, unknown>) => ({
        ...p,
        bairro_normalizado: p.bairro
          ? String(p.bairro).trim() || 'Sem bairro informado'
          : 'Sem bairro informado',
      }))
    } catch (posteErr) {
      console.error('Erro na query de postes do mapa:', posteErr)
      try {
        const fallback = await db.query(
          `SELECT id, codigo, endereco, latitude, longitude, status_ativo FROM postes WHERE status_ativo = TRUE ORDER BY codigo`
        )
        postes = fallback.rows.map((p: Record<string, unknown>) => ({
          ...p,
          bairro: null,
          bairro_normalizado: 'Sem bairro informado',
          rua: null, numero: null, complemento: null,
          tipo_luminaria: null, potencia: null,
        }))
      } catch (fallbackErr) {
        console.error('Fallback de postes tambem falhou:', fallbackErr)
        postes = []
      }
    }

    try {
      const bairrosResult = await db.query(
        `SELECT id, nome, cor FROM bairros WHERE ativo = TRUE ORDER BY nome`
      )
      bairrosRows = bairrosResult.rows
    } catch {
      try {
        const bairrosResult = await db.query(
          `SELECT id, nome FROM bairros WHERE ativo = TRUE ORDER BY nome`
        )
        bairrosRows = bairrosResult.rows.map((b: Record<string, unknown>) => ({ ...b, cor: null }))
      } catch {
        bairrosRows = []
      }
    }

    const totaisPorBairro: Record<string, number> = {}
    for (const p of postes) {
      const b = (p.bairro_normalizado as string) || 'Sem bairro informado'
      totaisPorBairro[b] = (totaisPorBairro[b] || 0) + 1
    }

    res.json({
      postes,
      bairros: bairrosRows,
      totaisPorBairro,
      total: postes.length,
    })
  } catch (error) {
    console.error('Erro ao buscar dados do mapa:', error)
    res.json({
      postes: [],
      bairros: [],
      totaisPorBairro: {},
      total: 0,
    })
  }
})

router.get('/relatorio-bairros', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT
        ${BAIRRO_NORMALIZADO} AS bairro,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE tipo_luminaria IS NOT NULL) AS com_luminaria,
        COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) AS com_localizacao,
        COUNT(*) FILTER (WHERE data_ultima_manutencao IS NOT NULL) AS com_manutencao
      FROM postes
      WHERE status_ativo = TRUE
      GROUP BY ${BAIRRO_NORMALIZADO}
      ORDER BY total DESC`
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao gerar relatorio por bairros:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.get('/', async (req: Request, res: Response) => {
  try {
    const bairro = req.query.bairro as string | undefined

    let query = `SELECT ${POSTE_SELECT} FROM postes WHERE status_ativo = TRUE`
    const params: string[] = []

    if (bairro) {
      params.push(bairro.trim())
      query += ` AND LOWER(${BAIRRO_NORMALIZADO}) = LOWER($1)`
    }

    query += ' ORDER BY codigo'

    const result = await db.query(query, params)
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao listar postes:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.get('/proximos/:lat/:lng/:raio', async (req: Request, res: Response) => {
  const lat = parseFloat(String(req.params.lat))
  const lng = parseFloat(String(req.params.lng))
  const raio = parseFloat(String(req.params.raio))

  if (isNaN(lat) || isNaN(lng) || isNaN(raio)) {
    res.status(400).json({ error: 'Parametros invalidos' })
    return
  }

  try {
    const result = await db.query(
      `SELECT ${POSTE_SELECT},
        CASE
          WHEN latitude IS NOT NULL AND longitude IS NOT NULL
          THEN (
            6371000 * acos(
              cos(radians($1)) * cos(radians(latitude)) *
              cos(radians(longitude) - radians($2)) +
              sin(radians($1)) * sin(radians(latitude))
            )
          )
          ELSE NULL
        END as distancia_metros
      FROM postes
      WHERE status_ativo = TRUE
        AND latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY distancia_metros
      LIMIT 50`,
      [lat, lng]
    )

    const filtrados = result.rows.filter((r: { distancia_metros: number | null }) =>
      r.distancia_metros !== null && r.distancia_metros <= raio
    )

    res.json(filtrados)
  } catch (error) {
    console.error('Erro ao buscar postes proximos:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const result = await db.query(
      `SELECT ${POSTE_SELECT}
      FROM postes WHERE id = $1`,
      [id]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Poste nao encontrado' })
      return
    }
    res.json(result.rows[0])
  } catch (error) {
    console.error('Erro ao buscar poste:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.post('/criar-e-vincular', authMiddleware, requireRole(['admin', 'gestor', 'operador']), async (req: Request, res: Response) => {
  const {
    codigo,
    endereco,
    rua,
    numero,
    bairro,
    complemento,
    latitude,
    longitude,
    tipo_luminaria,
    potencia,
    data_instalacao,
    solicitacao_id,
    ordem_servico_id,
  } = req.body

  if (!codigo) {
    res.status(400).json({ error: 'Codigo do poste e obrigatorio' })
    return
  }

  if (!solicitacao_id && !ordem_servico_id) {
    res.status(400).json({ error: 'Informe solicitacao_id ou ordem_servico_id' })
    return
  }

  try {
    let resolvedSolicitacaoId = solicitacao_id ? Number(solicitacao_id) : null

    if (!resolvedSolicitacaoId && ordem_servico_id) {
      const osResult = await db.query(
        'SELECT solicitacao_id FROM ordens_servico WHERE id = $1',
        [Number(ordem_servico_id)]
      )
      if (osResult.rows.length === 0) {
        res.status(404).json({ error: 'Ordem de servico nao encontrada' })
        return
      }
      resolvedSolicitacaoId = osResult.rows[0].solicitacao_id
    }

    if (resolvedSolicitacaoId) {
      const solResult = await db.query(
        'SELECT id, poste_id FROM solicitacoes WHERE id = $1',
        [resolvedSolicitacaoId]
      )
      if (solResult.rows.length === 0) {
        res.status(404).json({ error: 'Solicitacao nao encontrada' })
        return
      }
      if (solResult.rows[0].poste_id) {
        res.status(409).json({ error: 'Solicitacao ja possui poste vinculado' })
        return
      }
    }

    const query = `
      INSERT INTO postes (
        codigo, endereco, rua, numero, bairro, complemento,
        latitude, longitude, tipo_luminaria, potencia, data_instalacao
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `

    const values = [
      codigo,
      endereco || null,
      rua || null,
      numero || null,
      bairro || null,
      complemento || null,
      latitude || null,
      longitude || null,
      tipo_luminaria || null,
      potencia || null,
      data_instalacao || null,
    ]

    const result = await db.query(query, values)
    const novoPoste = result.rows[0]

    if (resolvedSolicitacaoId) {
      await db.query(
        'UPDATE solicitacoes SET poste_id = $1, codigo_poste_informado = $2 WHERE id = $3',
        [novoPoste.id, codigo, resolvedSolicitacaoId]
      )
    }

    await registrarAuditoria({
      tabela: 'postes',
      registroId: novoPoste.id,
      acao: 'criar',
      dadosDepois: novoPoste,
      usuarioId: req.user?.userId ?? null,
      usuarioNome: req.user?.nomeCompleto ?? null,
    })

    res.status(201).json({ poste: novoPoste, solicitacao_id: resolvedSolicitacaoId })
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'Codigo do poste ja existe' })
      return
    }
    console.error('Erro ao criar e vincular poste:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.post('/', authMiddleware, requireRole(['admin', 'gestor', 'operador']), async (req: Request, res: Response) => {
  const {
    codigo,
    endereco,
    rua,
    numero,
    bairro,
    complemento,
    latitude,
    longitude,
    tipo_luminaria,
    potencia,
    data_instalacao,
  } = req.body

  if (!codigo) {
    res.status(400).json({ error: 'Codigo do poste e obrigatorio' })
    return
  }

  try {
    const query = `
      INSERT INTO postes (
        codigo, endereco, rua, numero, bairro, complemento,
        latitude, longitude, tipo_luminaria, potencia, data_instalacao
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `

    const values = [
      codigo,
      endereco || null,
      rua || null,
      numero || null,
      bairro || null,
      complemento || null,
      latitude || null,
      longitude || null,
      tipo_luminaria || null,
      potencia || null,
      data_instalacao || null,
    ]

    const result = await db.query(query, values)

    await registrarAuditoria({
      tabela: 'postes',
      registroId: result.rows[0].id,
      acao: 'criar',
      dadosDepois: result.rows[0],
      usuarioId: req.user?.userId ?? null,
      usuarioNome: req.user?.nomeCompleto ?? null,
    })

    res.status(201).json(result.rows[0])
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'Codigo do poste ja existe' })
      return
    }
    console.error('Erro ao criar poste:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.put('/:id', authMiddleware, requireRole(['admin', 'gestor', 'operador']), async (req: Request, res: Response) => {
  const { id } = req.params
  const {
    codigo,
    endereco,
    rua,
    numero,
    bairro,
    complemento,
    latitude,
    longitude,
    tipo_luminaria,
    potencia,
    data_instalacao,
    data_ultima_manutencao,
    status_ativo,
  } = req.body

  try {
    const oldResult = await db.query(`SELECT ${POSTE_SELECT} FROM postes WHERE id = $1`, [id])
    const dadosAntes = oldResult.rows[0] || null

    const query = `
      UPDATE postes SET
        codigo = COALESCE($1, codigo),
        endereco = COALESCE($2, endereco),
        rua = COALESCE($3, rua),
        numero = COALESCE($4, numero),
        bairro = COALESCE($5, bairro),
        complemento = COALESCE($6, complemento),
        latitude = COALESCE($7, latitude),
        longitude = COALESCE($8, longitude),
        tipo_luminaria = COALESCE($9, tipo_luminaria),
        potencia = COALESCE($10, potencia),
        data_instalacao = COALESCE($11, data_instalacao),
        data_ultima_manutencao = COALESCE($12, data_ultima_manutencao),
        status_ativo = COALESCE($13, status_ativo)
      WHERE id = $14
      RETURNING *
    `

    const values = [
      codigo || null,
      endereco || null,
      rua || null,
      numero || null,
      bairro || null,
      complemento || null,
      latitude || null,
      longitude || null,
      tipo_luminaria || null,
      potencia || null,
      data_instalacao || null,
      data_ultima_manutencao || null,
      status_ativo !== undefined ? status_ativo : null,
      id,
    ]

    const result = await db.query(query, values)

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Poste nao encontrado' })
      return
    }

    await registrarAuditoria({
      tabela: 'postes',
      registroId: Number(id),
      acao: 'editar',
      dadosAntes,
      dadosDepois: result.rows[0],
      usuarioId: req.user?.userId ?? null,
      usuarioNome: req.user?.nomeCompleto ?? null,
    })

    res.json(result.rows[0])
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'Codigo do poste ja existe' })
      return
    }
    console.error('Erro ao atualizar poste:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
