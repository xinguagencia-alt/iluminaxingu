import { Router, Request, Response } from 'express'
import { db } from '../../db'
import { authMiddleware } from '../auth/middleware'

const router = Router()

const POSTE_SELECT = `id, codigo, endereco, rua, numero, bairro, complemento, latitude, longitude,
  tipo_luminaria, potencia, data_instalacao, data_ultima_manutencao, status_ativo`

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT ${POSTE_SELECT}
      FROM postes WHERE status_ativo = TRUE ORDER BY codigo`
    )
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

router.post('/', authMiddleware, async (req: Request, res: Response) => {
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

router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
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
